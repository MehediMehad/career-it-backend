import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

interface FileFieldMapping {
  [key: string]:
    | 'single'
    | 'array'
    | { target: string; mode: 'single' | 'array'; filedName: string; type?: 'multiple' | 'single' }; // 👈 dynamic nested mapping
}

const validateRequest =
  (schema: z.ZodTypeAny, fileFields?: FileFieldMapping) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // May actually come as a string from multipart/form-data
      let data = req.body?.data ?? req.body;

      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      // console.log('✅', req.files);

      // Merge single file fields
      // if (fileFields && req.file) {
      //   const fileFieldNames = Object.keys(fileFields);
      //   const file = req.file as Express.MulterS3.File;
      //   if (fileFieldNames.includes(file.fieldname) && fileFields[file.fieldname] === 'single') {
      //     data[file.fieldname] = file.location;
      //   }
      // }

      // // 🗂️ Handle multiple file fields
      // if (fileFields && req.files) {
      //   const files = req.files as { [key: string]: Express.MulterS3.File[] };

      //   for (const fieldName in fileFields) {
      //     const config = fileFields[fieldName];
      //     const uploadedFiles = files[fieldName];
      //     if (!uploadedFiles) continue;

      //     // 🧠 If simple (non-nested)
      //     if (config === 'single') {
      //       data[fieldName] = uploadedFiles[0].location;
      //     } else if (config === 'array') {
      //       data[fieldName] = uploadedFiles.map((f) => f.location);
      //     }
      //     // // 🧩 If nested mapping
      //     // else if (typeof config === 'object' && config.target) {
      //     //   const { target, mode, filedName, type } = config;
      //     //   console.log('target', target, 'mode', mode, 'filedName', fieldName);

      //     //   if (data[target] && Array.isArray(data[target])) {
      //     //     const urls =
      //     //       mode === 'array'
      //     //         ? uploadedFiles.map((f) => f.location)
      //     //         : [uploadedFiles[0].location];

      //     //     console.log('uploadedFiles', uploadedFiles);

      //     //     // 🧠 Dynamically assign images into nested array elements
      //     //     // eslint-disable-next-line
      //     //     data[target] = data[target].map((item: any, index: number) => ({
      //     //       ...item,
      //     //       [filedName]: urls[index] ?? null, // ✅ no duplicate fallback
      //     //     }));
      //     //   }
      //     // }
      //     else if (typeof config === 'object' && config.target) {
      //       console.log('files🛑🛑🛑', files);
      //       // 🧩 If nested mapping
      //       const { target, mode, filedName, type } = config;

      //       if (data[target] && Array.isArray(data[target])) {
      //         const urls =
      //           mode === 'array'
      //             ? uploadedFiles.map((f) => f.location)
      //             : [uploadedFiles[0].location];

      //         // eslint-disable-next-line
      //         data[target] = data[target].map((item: any) => {
      //           // 🧠 If it is multiple type, assign the entire urls array.
      //           if (type === 'multiple') {
      //             return {
      //               ...item,
      //               [filedName]: urls,
      //             };
      //           }

      //           // 🧠 If single, only the first one
      //           return {
      //             ...item,
      //             [filedName]: urls[0],
      //           };
      //         });
      //       }
      //     }
      //   }
      // }

      // Validate with Zod
      console.log('🎯 Validated Request:', data);
      await schema.parseAsync(data);

      // Overwrite req.body with parsed & validated object
      req.body = data;

      next();
    } catch (err) {
      next(err);
    }
  };

export const validateRequestArray =
  (schema: z.ZodTypeAny, fileFields?: FileFieldMapping) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Parse body if string (multipart/form-data)
      let data = req.body.data ?? req.body;

      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      // Merge single file fields
      // if (fileFields && req.file) {
      //   const fileFieldNames = Object.keys(fileFields);
      //   const file = req.file as Express.MulterS3.File;
      //   if (fileFieldNames.includes(file.fieldname) && fileFields[file.fieldname] === 'single') {
      //     data[file.fieldname] = file.location;
      //   }
      // }

      // // Merge multiple files
      // if (fileFields && req.files) {
      //   const files = req.files as { [key: string]: Express.MulterS3.File[] };
      //   for (const fieldName in fileFields) {
      //     if (files[fieldName]) {
      //       if (fileFields[fieldName] === 'single') {
      //         data[fieldName] = files[fieldName][0].location;
      //       } else if (fileFields[fieldName] === 'array') {
      //         data[fieldName] = files[fieldName].map((f) => f.location);
      //       }
      //     }
      //   }
      // }

      // Validate with Zod
      await schema.parseAsync(data);

      // Overwrite req.body with parsed & validated object
      req.body = data;

      next();
    } catch (err) {
      next(err);
    }
  };

export default validateRequest;
