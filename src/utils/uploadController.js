

const { S3Client,HeadObjectCommand  } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const User = require('../modules/user/user.model');
const multer = require('multer');
const path = require('path');
const signedUrlGenrate = require('./signedUrlGenrate');

// AWS S3 Client (v3)
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}); 

// Allowed image types
// Allowed image and PDF types for policy documents
const allowedPolicyDocMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

// Multer for parsing multipart form data with filter
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 1MB limit
  },
  fileFilter: (req, file, cb) => {
    if (allowedPolicyDocMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDF files are allowed for policy documents.'));
    }
  },
});

// Upload Controller
const uploadFile = async (req, res) => {
  const { userId } = req.user;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: User ID not found' });
  }

  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type/size' });
  }

  const findUserProfile = await User.findById(userId);

  if (!findUserProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (findUserProfile.picture) {
    await signedUrlGenrate.deleteFileFromS3(process.env.S3_BUCKET_NAME, findUserProfile.picture);
  } 

  const fileName = `profile-pics/${Date.now()}_${file.originalname}`;

  try {
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: file.buffer, 
        ContentType: file.mimetype,
      },
    });

    const result = await upload.done();

    await User.findByIdAndUpdate(userId, { picture: result.Key }, { new: true });

    res.status(200).json({
      message: 'File uploaded successfully',
      fileUrl: result.Location,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
};

// module.exports = { upload, uploadFile };






// ✅ Reusable upload function
const uploadImageToS3 = async (file) => {
  if (!file) throw new Error('No file provided');

  const fileName = `companyLogo/${Date.now()}_${file.originalname}`;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    },
  });

  const result = await upload.done();
  return result;
};

const uploadUserPolicyDocumentToS3 = async (file) => {
  if (!file) throw new Error('No file provided');

  const fileName = `userPolicyDocuments/${Date.now()}_${file.originalname}`;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    },
  });

  const result = await upload.done();
  return result;
};


  // const blogUploadImageToS3 = async (file) => {
  //   if (!file) throw new Error('No file provided');

  //   const fileName = `blogImages/${Date.now()}_${file.originalname}`;

  //   const upload = new Upload({
  //     client: s3,
  //     params: {
  //       Bucket: process.env.S3_BUCKET_NAME,
  //       Key: fileName,
  //       Body: file.buffer,
  //       ContentType: file.mimetype,
  //       // ACL: 'public-read', // 👈 This makes the object publicly readable
  //     },
  //   });

  //   const result = await upload.done();
  //   return result;
  // };

  const blogUploadImageToS3 = async (file) => {
    if (!file) throw new Error("No file provided");
  
    const fileName = `blogImages/${file.originalname}`;
    const bucket = process.env.S3_BUCKET_NAME;
  
    try {
      // Check if file already exists
      const headCommand = new HeadObjectCommand({
        Bucket: bucket,
        Key: fileName,
      });
      await s3.send(headCommand);
  
      // If no error is thrown, file exists
      const s3Url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      return {
        alreadyExists: true,
        url: s3Url,
        key: fileName,
      };
    } catch (err) {
      // S3 returns 404 if file doesn't exist (with ListBucket permission)
      // or 403 if file doesn't exist but IAM lacks ListBucket permission
      const statusCode = err.$metadata?.httpStatusCode;
      if (statusCode !== 404 && statusCode !== 403 && err.name !== "NotFound") {
        throw err; // Unexpected error
      }
  
      const upload = new Upload({
        client: s3,
        params: {
          Bucket: bucket,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
          // ACL: "public-read", // Optional: make publicly readable
        },
      });
  
      const result = await upload.done();
      return {
        alreadyExists: false,
        url: result.Location,
        key: fileName,
      };
    }
  };





module.exports = {
  upload,
  uploadFile, // your original handler
  uploadImageToS3, // new reusable function
  blogUploadImageToS3,
  uploadUserPolicyDocumentToS3
};
