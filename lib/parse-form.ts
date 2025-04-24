import { writeFile } from "fs/promises";
import { NextRequest } from "next/server";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import * as multiparty from "multiparty";

export interface ParsedForm {
  fields: { [key: string]: string[] };
  files: {
    [key: string]: {
      fieldName: string;
      originalFilename: string;
      path: string;
      headers: { [key: string]: string };
      size: number;
    }[];
  };
}

/**
 * Parses a multipart form data request and saves uploaded files to temporary directory
 */
export async function parseForm(req: NextRequest): Promise<ParsedForm> {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form();
    
    form.parse(req.body as any, async (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      
      try {
        // Process uploaded files if any
        for (const fileKey in files) {
          for (const file of files[fileKey]) {
            const fileData = file as any;
            
            // Create a temporary file path
            const tempFilePath = join(tmpdir(), `${randomUUID()}-${fileData.originalFilename}`);
            
            // Save file to disk
            if (fileData.buffer) {
              await writeFile(tempFilePath, fileData.buffer);
              fileData.path = tempFilePath;
            }
          }
        }
        
        resolve({ fields, files } as ParsedForm);
      } catch (error) {
        reject(error);
      }
    });
  });
} 