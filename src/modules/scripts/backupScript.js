const mongoose = require('mongoose');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
require('dotenv').config();

// AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BACKUP_BUCKET = 'reviewwindow';
const BACKUP_DIR = path.join(__dirname, 'db_backups');
const CRON_SCHEDULE = process.env.BACKUP_CRON || '28 1 * * *'; // Default: every day at 1:28 AM

// Ensure backup directory exists at startup (helps when running under cron/service)
try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
  }
} catch (err) {
  console.warn('⚠️ Could not create backup directory at startup:', err && err.message ? err.message : err);
}

// helper to build a fresh S3 client (useful for scheduled runs that may have different env)
const getS3Client = () => {
  return new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
};

// small helper to mask secrets in logs
const mask = (str) => {
  if (!str) return '(missing)';
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URL);
      console.log('✅ Connected to MongoDB for backup');
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

/**
 * Get all collection names from the database
 */
const getAllCollections = async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    return collections.map(collection => collection.name);
  } catch (error) {
    console.error('❌ Error fetching collections:', error);
    throw error;
  }
};

/**
 * Export a single collection to JSON file
 */
const exportCollection = async (collectionName) => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    const documents = await collection.find({}).toArray();
    
    const fileName = `${collectionName}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    
    // Ensure the backup dir exists just before writing (cron contexts may differ)
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    } catch (err) {
      // non-fatal, we'll try writing and let the outer catch handle it
    }

    // Write to file with proper formatting
    fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
    
    console.log(`✅ Exported ${documents.length} documents from ${collectionName}`);
    return { fileName, filePath, documentCount: documents.length };
  } catch (error) {
    console.error(`❌ Error exporting collection ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Create a zip archive of all backup files
 */
const createZipArchive = async (backupFiles, timestamp) => {
  return new Promise((resolve, reject) => {
    const zipFileName = `database-backup-${timestamp}.zip`;
    const zipFilePath = path.join(BACKUP_DIR, zipFileName);
    
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      // Prefer actual file size from filesystem - archiver.pointer() can be unreliable across streams
      let fileSize = 0;
      try {
        fileSize = fs.statSync(zipFilePath).size;
      } catch (err) {
        fileSize = archive.pointer();
      }

      console.log(`✅ Created zip archive: ${zipFileName} (${fileSize} total bytes)`);
      resolve({ zipFileName, zipFilePath, size: fileSize });
    });
    
    archive.on('error', (err) => {
      console.error('❌ Error creating zip archive:', err);
      reject(err);
    });

    archive.on('warning', (warn) => {
      console.warn('⚠️ Archiver warning:', warn && warn.message ? warn.message : warn);
    });

    // 'end' indicates data has been drained
    output.on('end', () => {
      console.log('ℹ️ Zip output stream ended');
    });

    archive.pipe(output);
    
    // Add all backup files to archive
    if (!Array.isArray(backupFiles) || backupFiles.length === 0) {
      const err = new Error('No backup files to archive');
      reject(err);
      return;
    }

    backupFiles.forEach(file => {
      archive.file(file.filePath, { name: file.fileName });
    });
    
    // finalize returns a promise in later versions but may still be synchronous here
    archive.finalize().catch(err => {
      console.error('❌ Archiver finalize failed:', err && err.message ? err.message : err);
      reject(err);
    });
  });
};

/**
 * Upload file to S3
 */
const uploadToS3 = async (filePath, fileName) => {
  try {
    // Verify file exists and log size before uploading (helps cron debugging)
    if (!fs.existsSync(filePath)) {
      const err = new Error(`Zip file not found before upload: ${filePath}`);
      console.error('❌', err.message);
      throw err;
    }
    const fileStats = fs.statSync(filePath);
    console.log(`📦 Preparing to upload ${path.basename(filePath)} (${(fileStats.size / (1024*1024)).toFixed(2)} MB)`);
    const fileStream = fs.createReadStream(filePath);
    
    // Upload to DB-Backup-Prod folder within the bucket
    const s3Key = `DB-Backup-Prod/${fileName}`;
    
    const uploadParams = {
      Bucket: BACKUP_BUCKET,
      Key: s3Key,
      Body: fileStream,
      ContentType: 'application/zip',
      Metadata: {
        'backup-date': new Date().toISOString(),
        'file-size': fileStats.size.toString(),
      },
    };
    
    // create a fresh client at upload time (avoids stale env if process env changed)
    const client = getS3Client();
    const upload = new Upload({
      client,
      params: uploadParams,
    });
    
    // Track upload progress if available
    upload.on && upload.on('httpUploadProgress', (progress) => {
      try {
        const percentage = Math.round((progress.loaded / progress.total) * 100);
        process.stdout.write(`\r📤 Uploading to S3: ${percentage}%`);
      } catch (err) {
        // ignore progress calculation errors
      }
    });
    
    const result = await upload.done();

    console.log('\n📦 S3 upload raw result:', result);

    // After upload succeeds, attempt to close the read stream and remove the local zip.
    // On Windows the file may remain locked briefly; retry a few times with small delays.
    const attemptDeleteLocalZip = async () => {
      try {
        // Attempt to gracefully close the read stream if possible
        if (fileStream && typeof fileStream.close === 'function') {
          try { fileStream.close(); } catch (e) { /* ignore */ }
        }
        if (fileStream && typeof fileStream.destroy === 'function') {
          try { fileStream.destroy(); } catch (e) { /* ignore */ }
        }

        const maxAttempts = 10;
        let delay = 200; // ms
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Deleted local zip file after upload: ${path.basename(filePath)}`);
            } else {
              console.log(`ℹ️ Local zip already removed or not found: ${path.basename(filePath)}`);
            }
            return; // success
          } catch (unlinkErr) {
            const code = unlinkErr && unlinkErr.code ? unlinkErr.code : '(no-code)';
            const msg = unlinkErr && unlinkErr.message ? unlinkErr.message : String(unlinkErr);
            if (attempt < maxAttempts) {
              console.warn(`⚠️ Delete attempt ${attempt} failed (code=${code}), retrying in ${delay}ms: ${msg}`);
              // wait before retrying (exponential backoff)
              await new Promise(res => setTimeout(res, delay));
              delay = Math.min(2000, delay * 2);
            } else {
              console.warn(`⚠️ Could not delete local zip after upload (final): code=${code} message=${msg}`);
              try {
                // create a marker file with details to help debugging
                const markerPath = `${filePath}.delete-failed-${Date.now()}.log`;
                fs.writeFileSync(markerPath, `delete-failed:\ncode=${code}\nmessage=${msg}\nstack=${unlinkErr && unlinkErr.stack ? unlinkErr.stack : ''}`);
                console.log(`ℹ️ Wrote delete-failure marker: ${markerPath}`);
              } catch (markerErr) {
                console.warn('⚠️ Could not write delete-failure marker file:', markerErr && markerErr.message ? markerErr.message : markerErr);
              }
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ Unexpected error while attempting to delete local zip:', err && err.message ? err.message : err);
      }
    };

  // Do not delete local zip yet; wait for verification below. (Will delete after HeadObject verification.)

    // The v3 upload result doesn't always include a Location property.
    // Build a best-effort S3 URL for logging.
    const s3Location = result && result.Location
      ? result.Location
      : `https://${BACKUP_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    console.log('\n✅ Upload finished');
    console.log(`📁 S3 Path: ${BACKUP_BUCKET}/${s3Key}`);
    console.log(`🔗 Public URL (best-effort): ${s3Location}`);

    // Verify the object exists (HeadObject). This helps detect permission or region/account issues.
    let verified = false;
    try {
      const headClient = client; // use the same client we uploaded with
      await headClient.send(new HeadObjectCommand({ Bucket: BACKUP_BUCKET, Key: s3Key }));
      verified = true;
      console.log('🔎 Verified: S3 object is present');
    } catch (headErr) {
      console.warn('⚠️ Could not verify object via HeadObject (may be permissions or eventual consistency):', headErr && headErr.message ? headErr.message : headErr);
      if (headErr && headErr.$metadata) {
        console.warn('HeadObject metadata:', headErr.$metadata);
      }
    }

    // If verification succeeded, attempt to delete the local zip
    if (verified) {
      try {
        if (typeof attemptDeleteLocalZip === 'function') {
          await attemptDeleteLocalZip();
        }
      } catch (delErr) {
        console.warn('⚠️ Error while deleting local zip after verification:', delErr && delErr.message ? delErr.message : delErr);
      }
    } else {
      console.warn('⚠️ Upload verified=false; local zip will be retained for inspection');
    }

    return { ...result, Location: s3Location, Key: s3Key, Bucket: BACKUP_BUCKET, verified };
  } catch (error) {
    console.error('❌ Error uploading to S3:', error);
    throw error;
  }
};

/**
 * Clean up local backup files
 */
const cleanupLocalFiles = (files) => {
  console.log('\n🗑️ Cleaning up local backup files...');
  let cleanedCount = 0;
  let failedCount = 0;
  
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        const fileSize = fs.statSync(file).size;
        fs.unlinkSync(file);
        console.log(`✅ Deleted: ${path.basename(file)} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
        cleanedCount++;
      } else {
        console.log(`⚠️ File not found: ${path.basename(file)}`);
      }
    } catch (error) {
      console.error(`❌ Error deleting ${path.basename(file)}:`, error.message);
      failedCount++;
    }
  });
  
  console.log(`🗑️ Cleanup completed: ${cleanedCount} files deleted, ${failedCount} failed`);
};

/**
 * Send backup notification (optional - you can integrate with your email service)
 */
const sendBackupNotification = async (backupInfo) => {
  // You can integrate this with your existing email service
  console.log('📧 Backup notification details:', {
    timestamp: backupInfo.timestamp,
    collections: backupInfo.collections,
    totalDocuments: backupInfo.totalDocuments,
    fileSize: `${(backupInfo.fileSize / (1024 * 1024)).toFixed(2)} MB`,
    s3Location: backupInfo.s3Location,
  });
};

/**
 * Main backup function
 */
const performBackup = async () => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  console.log(`\n🚀 Starting database backup at ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
  
  try {
    // Connect to database
    await connectDB();
    
    // Get all collections
    const collections = await getAllCollections();
    console.log(`📋 Found ${collections.length} collections: ${collections.join(', ')}`);
    
    // Export each collection
    const backupFiles = [];
    let totalDocuments = 0;
    
    for (const collectionName of collections) {
      const exportResult = await exportCollection(collectionName);
      backupFiles.push(exportResult);
      totalDocuments += exportResult.documentCount;
    }
    
    // Create zip archive
    const zipResult = await createZipArchive(backupFiles, timestamp);
    
    // Upload to S3
    const s3Result = await uploadToS3(zipResult.zipFilePath, zipResult.zipFileName);
    
    // Immediately cleanup local files after successful upload and verification
    if (s3Result && s3Result.verified) {
      console.log('\n🎯 S3 upload verified, cleaning up local files...');
      const filesToCleanup = [
        ...backupFiles.map(f => f.filePath),
        zipResult.zipFilePath,
      ];
      await cleanupLocalFiles(filesToCleanup);
    } else {
      console.warn('\n⚠️ Upload completed but verification failed - local backup files retained for inspection');
    }
    
    // Calculate execution time
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Backup summary
    const backupInfo = {
      timestamp: new Date().toISOString(),
      collections: collections.length,
      totalDocuments,
      fileSize: zipResult.size,
      s3Location: s3Result.Location,
      executionTime: `${executionTime}s`,
    };
    
    console.log('\n✅ Backup completed successfully!');
    console.log('📊 Backup Summary:');
    console.log(`   • Collections: ${backupInfo.collections}`);
    console.log(`   • Total documents: ${backupInfo.totalDocuments}`);
    console.log(`   • File size: ${(backupInfo.fileSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   • S3 location: ${backupInfo.s3Location}`);
    console.log(`   • Execution time: ${backupInfo.executionTime}`);
    console.log('='.repeat(60));
    
    // Send notification
    await sendBackupNotification(backupInfo);
    
    return backupInfo;
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    
    // You might want to send an error notification here
    console.log('📧 Sending error notification...');
    
    throw error;
  }
};

/**
 * Schedule backup job - every day at 12:00 PM (noon)
 */
const scheduleBackup = () => {
  console.log('⏰ Scheduling database backup (cron):', CRON_SCHEDULE);
  console.log('🔐 AWS_ACCESS_KEY_ID:', mask(process.env.AWS_ACCESS_KEY_ID));
  console.log('🌍 AWS_REGION:', process.env.AWS_REGION || '(missing)');

  // Cron expression can be provided via BACKUP_CRON env var
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('\n⏰ Scheduled backup triggered at', new Date().toLocaleString());
    try {
      await performBackup();
    } catch (error) {
      console.error('❌ Scheduled backup failed:', error && error.message ? error.message : error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });
  
  console.log('✅ Backup scheduler initialized');
  console.log('📅 Next backup will run according to cron schedule');
};

/**
 * Manual backup trigger (for testing)
 */
const runManualBackup = async () => {
  console.log('🔧 Running manual backup...');
  try {
    await performBackup();
    process.exit(0);
  } catch (error) {
    console.error('❌ Manual backup failed:', error);
    process.exit(1);
  }
};

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes('--manual') || args.includes('-m')) {
  // Run backup immediately
  runManualBackup();
} else if (args.includes('--schedule') || args.includes('-s')) {
  // Start the scheduler
  scheduleBackup();
  
  // Keep the process running
  console.log('🔄 Backup scheduler is running. Press Ctrl+C to stop.');
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down backup scheduler...');
    mongoose.connection.close();
    process.exit(0);
  });
  
} else {
  console.log(`
🔧 Database Backup Script Usage:
  node backupScript.js --manual     # Run backup immediately
  node backupScript.js --schedule   # Start scheduler for daily backups at 12 PM
  
📋 Environment Variables Required:
  - MONGODB_URL
  - AWS_REGION
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  
📦 S3 Bucket: ${BACKUP_BUCKET}
⏰ Schedule: Daily at 12:00 PM
  `);
}

module.exports = {
  performBackup,
  scheduleBackup,
  runManualBackup,
};
