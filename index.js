const express = require("express");
const fs = require("fs");
const multer = require("multer");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const { Configuration, OpenAIApi } = require("openai");
const path = require("node:path");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.urlencoded({ extended: false }));

app.use(cors());

const port = process.env.PORT || 8000

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const fileName = `${file.originalname}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage });

const middle = {
  clearDir: function (req, res, next) {
    try {
      fs.readdir("uploads/", (err, files) => {
        for (const file of files) {
          fs.unlink(path.join("uploads/", file), (err) => {
            if (err) throw err;
          });
        }
      });
    } catch (err) {
      console.error(err);
    }
    next();
  },
  uploadss: upload.single("file"),
};

app.get("/",(req,res)=>{
  res.send("hello")
})

app.post("/upload", [middle.clearDir, middle.uploadss], async (req, res) => {
  const dataBuffer = fs.readFileSync(`./uploads/${req.file.originalname}`);
  let file_type = req.file.originalname.split(".");
  file_type = file_type[file_type.length - 1];
  if (file_type === "pdf") {
    pdf(dataBuffer)
      .then((data) => {
        return data.text;
      })
      .then((result) => {
        textForm(result);
      })
      .catch((e) => console.log(e));
    console.log(req.file);
  } else if (file_type === "docx") {
    mammoth
      .extractRawText({ buffer: dataBuffer })
      .then((result) => {
        return result.value;
      })
      .then((result) => {
        textForm(result);
      })
      .catch((e) => console.log(e));
  }
  const textForm = async (file_text) => {
    try {
      let prompt = `Fill the following fields candidate_name:,phone_number:,email_id:,Previous_Job_and_Company_Name:,Graduation_College:, from the following resume and please leave the field blank if it doesn't exist:${file_text}`;
      // console.log(file_text)
      const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt,
        max_tokens: 1200,
      });

      const completion = response.data.choices[0].text;
      let obj = {};
      completion.split("\n").forEach((line) => {
        let [key, value] = line.split(": ");
        key = key.toLocaleLowerCase().split(" ").join("_");
        obj[key] = value;
      });

      return res.status(200).json({
        success: true,
        message: obj,
      });
    } catch (error) {
      console.log("hello");
    }
  };
});

app.listen(port, () => {
  console.log("server started");
});

// app.post('/uploadPdfFiles', function (req, res, callback_fun) {
//   try {
//       var body = req.body;
//       var auth = req.auth
//       var data = {
//       }
//       if (body.org_id) {
//           data['org_id'] = Number(body.org_id)
//       }
//       if (body.files && !body.files.length) {
//           body.files = [body.files]
//       }
//       var insertData = [];
//       if (body.files && body.files.length) {
//           // console.log(body.files);
//           let fileError = false;
//           body.files.forEach((file, i) => {
//               var ext = path.extname(file.file_name);
//               fileName = file.file_name;
//               if (ext !== '.pdf') {
//                   fileError = true;
//               }
//           })
//           if (fileError) {
//               throw new Error("Only PDFs are allowed");
//           } else {

//               async.forEachOfSeries(body.files, (file, key, cb) => {
//                   var ext = path.extname(file.file_name);
//                   fileName = file.file_name;
//                   // if (ext !== '.docx' && ext !== '.pdf' && ext !== '.doc') {
//                   if (ext !== '.pdf') {
//                       cb();
//                   } else {
//                       var s3_upload_dir = auth.org_id + '/ats/documents/pdf-match/';
//                       util.uploadFileNew(file, s3_upload_dir, async (err, fileData) => {
//                           if (err) {
//                               console.log(err + "s3 error")
//                               cb()
//                           } else {
//                               let pdf_content = await uploadPdfMatchModel.GetTextFromPDF(file.buffer);
//                               insertData.push([
//                                   req.auth.org_id, req.auth.user_id,
//                                   data.file_caption ? data.file_caption : null, fileData.originalname, fileData.file_name, pdf_content ? pdf_content : null, 0, req.auth.user_id, util.get_curr_date('Y-m-d H:i:s')
//                               ]);
//                               cb()
//                           }
//                       });
//                   }
//               }, (er) => {
//                   if (er) {
//                       console.log("erf", er);
//                       res.send(er);
//                   } else {
//                       if (insertData.length) {
//                           let sqlBulk = mysql.format(`INSERT INTO ats_pdf_parsing_data (ORG_ID,USER_ID,FILE_CAPTION,UPLOADED_FILE_NAME,PDF_S3_NAME,PDF_EXTRACT_CONTENT,DELETE_STATUS,CREATED_BY,CREATED_DATE) VALUES ?;`, [insertData]);
//                           mysql.query(sqlBulk, async (err, response) => {
//                               if (err) {
//                                   res.send(err);
//                               } else {
//                                   var response = util.getFormatedResponse(err, {
//                                       id: response.insertId, message: 'Files are successfully uploaded.'
//                                   });
//                                   res.status(response.code).json(response);
//                               }
//                           });
//                       } else {
//                           var response = util.getFormatedResponse(new Error("Files not parsed"));
//                           res.status(response.code).json(response);
//                       }
//                   }
//               });
//           }
//       } else {
//           callback_fun(new Error("Files are not provided. Please try again."))
//       }
//   } catch (err) {
//       console.log("errred", err);
//       callback_fun(err)
//   }
// });
