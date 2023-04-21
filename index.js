"use strict";
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

class FileLocationConverter {
  constructor(config) {
    console.log("config", config);
    this.config = config;
  }

  getKey(file) {
    const filename = `${file.hash}${file.ext}`;
    return `${filename}`;
  }

  getUrl(data) {
    return `${this.config.endpoint}/${data.Key}`;
  }
}

module.exports = {
  init: (config) => {
    console.log("config", config);
    const converter = new FileLocationConverter(config);

    process.env.AWS_ACCESS_KEY_ID = config.key;
    process.env.AWS_SECRET_ACCESS_KEY = config.secret;

    AWS.config.update({
      accessKeyId: config.key,
      secretAccessKey: config.secret,
    });

    const S3 = new AWS.S3({
      endpoint: "ams3.digitaloceanspaces.com",
      accessKeyId: config.key,
      secretAccessKey: config.secret,
      params: {
        ACL: "public-read",
        Bucket: config.bucket,
      },
    });

    const upload = (file) =>
      new Promise((resolve, reject) => {
        const fileKey = `${file.hash}-${Date.now()}${file.ext}`;
        console.log("file key", fileKey);

        console.log("file path ", file.stream.path);

        const params = {
          ACL: "public-read",
          Bucket: config.bucket,
          Body: fs.createReadStream(file.stream.path),
          Key: fileKey,
        };

        S3.upload(
          params,
          //--- Callback handler
          (err, data) => {
            console.error("got error, ", err);
            if (err) return reject(err);
            strapi.log.info("got data ", data);
            file.url = converter.getUrl(data);
            delete file.buffer;
            resolve();
          }
        );
      });

    return {
      upload,

      uploadStream: (file) =>
        new Promise((resolve, reject) => {
          const _buf = [];

          file.stream.on("data", (chunk) => _buf.push(chunk));
          file.stream.on("end", () => {
            file.buffer = Buffer.concat(_buf);
            resolve(upload(file));
          });
          file.stream.on("error", (err) => reject(err));
        }),

      delete: (file) =>
        new Promise((resolve, reject) => {
          //--- Delete the file from the space
          S3.deleteObject(
            {
              Bucket: config.bucket,
              Key: converter.getKey(file),
            },

            //--- Callback handler
            (err, data) => {
              if (err) return reject(err);
              else resolve();
            }
          );
        }),
    };
  },
};
