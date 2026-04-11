const { S3Client, GetObjectCommand,DeleteObjectCommand  } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Create the S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Generates a signed URL for an S3 object.
 * @param {string} bucketName - The name of your S3 bucket.
 * @param {string} key - The object key (path inside the bucket).
 * @param {number} expiresIn - Expiration time in seconds (default: 300 = 5 minutes).
 * @returns {Promise<string>} - The signed URL.
 */


exports.generateSignedUrl = async (bucketName, key, expiresIn = 300) => {

    try {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        });
    
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        return signedUrl;
      } catch (error) {
        console.error('Error generating signed URL:', error);
        throw error;
      }

}

/**
 * Deletes a file from S3.
 * @param {string} bucketName - The name of your S3 bucket.
 * @param {string} fileKey - The key of the file to delete.
 * @returns {Promise<object>} - The delete response from S3.
 */
exports.deleteFileFromS3 = async (bucketName, fileKey) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });

    const response = await s3Client.send(command);
    return response;
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
};



