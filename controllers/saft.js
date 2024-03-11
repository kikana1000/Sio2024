const multer = require("multer");
const xml2js = require("xml2js");
const fs = require("fs");
const path = require("path");
const xsd = require("xsd-validator");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const moment = require("moment");
const Request = require("../utils/RequestUtils");
require("dotenv").config();

var saftController = {};

const uploadPath = "./files/upload";
const V_FILE_UPLOAD = "upload_file/file_upload";

const NIPC = process.env.NIPC;

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./files/upload"); // Specify the destination directory where you want to save the XML file
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Use the original filename for the uploaded file
  },
});

//const upload = multer({ storage: storage }).single("xmlFile"); // 'xmlFile' is the field name of the file input in your form
const upload = multer({
  dest: uploadPath,
  fileFilter: function (req, file, cb) {
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (fileExt === ".xml") {
      cb(null, true);
    } else {
      cb(new Error("Only .xml files are allowed"));
    }
  },
}).single("xmlFile");

//#region Upload
saftController.formUpload = function (req, res) {
  res.render(V_FILE_UPLOAD, {
    message: "",
    success: "",
    fiscal_year: req.cookies.fiscal_year,
  });
};

saftController.upload = function (req, res) {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Handle Multer errors
      return res.render(V_FILE_UPLOAD, {
        message: "Error uploading file",
        success: "",
        fiscal_year: req.cookies.fiscal_year,
      });
    } else if (err) {
      // Handle other errors
      return res.render(V_FILE_UPLOAD, {
        message: err.message,
        success: "",
        fiscal_year: req.cookies.fiscal_year,
      });
    }

    if (!req.file) {
      return res.render(V_FILE_UPLOAD, {
        message: "No file uploaded",
        success: "",
        fiscal_year: req.cookies.fiscal_year,
      });
    }

    // Read the file content
    const fileContent = fs.readFileSync(req.file.path);

    // Parse XML to JSON
    const parser = new xml2js.Parser();
    parser.parseString(fileContent, async function (err, result) {
      if (err) {
        return res.render(V_FILE_UPLOAD, {
          message: "Error parsing XML to JSON",
          success: "",
          fiscal_year: req.cookies.fiscal_year,
        });
      }

      const jsonData = result;

      //console.log(JSON.stringify(result, null, 2));

      // Validate TaxRegistrationNumber is valid
      const isValid = await validNIF(jsonData.AuditFile.Header[0].TaxRegistrationNumber[0]);
      if (!isValid) {
        return res.render(V_FILE_UPLOAD, {
          message: "Invalid TaxRegistrationNumber",
          success: "",
          fiscal_year: req.cookies.fiscal_year,
        });
      }

      // Validate TaxRegistrationNumber company
      if (jsonData.AuditFile.Header[0].TaxRegistrationNumber[0] !== NIPC) {
        return res.render(V_FILE_UPLOAD, {
          message: "SAFT-PT file is not for this company",
          success: "",
          fiscal_year: req.cookies.fiscal_year,
        });
      }

      // Validate SAFT-PT version
      if (jsonData.AuditFile.Header[0].AuditFileVersion[0] !== "1.04_01") {
        return res.render(V_FILE_UPLOAD, {
          message: "SAFT-PT version is not supported",
          success: "",
          fiscal_year: req.cookies.fiscal_year,
        });
      }

      // Validate FiscalYear is superior atual year
      const currentYear = new Date().getFullYear();
      if (jsonData.AuditFile.Header[0].FiscalYear[0] > currentYear) {
        return res.render(V_FILE_UPLOAD, {
          message: "FiscalYear is superior atual year",
          success: "",
          fiscal_year: req.cookies.fiscal_year,
        });
      }

      // Save the JSON file
      const jsonFileName = req.file.originalname.replace(".xml", ".json");
      const jsonFilePath = path.join(uploadPath, jsonFileName);
      fs.writeFile(
        jsonFilePath,
        JSON.stringify(jsonData, null, 2),
        function (err) {
          if (err) {
            return res.render(V_FILE_UPLOAD, {
              message: "Error saving JSON file",
              success: "",
              fiscal_year: req.cookies.fiscal_year,
            });
          }

          // Delete the XML file
          fs.unlink(req.file.path, function (err) {
            if (err) {
              console.error("Error deleting XML file:", err);
            }
          });

          res.render(V_FILE_UPLOAD, {
            message: "",
            success: "File uploaded, saved, and converted to JSON successfully",
            fiscal_year: req.cookies.fiscal_year,
          });
        }
      );
    });
    processFile();
  });
};
//#endregion

function processFile() {
  const directoryPath = "./files/upload";

  fs.readdir(directoryPath, function (err, files) {
    if (err) {
      console.error("Error reading directory:", err);
      return;
    }

    files.forEach(function (file) {
      if (file.endsWith(".json")) {
        const filePath = directoryPath + "/" + file;

        fs.readFile(filePath, "utf8", function (err, data) {
          if (err) {
            console.error("Error reading JSON file:", err);
            return;
          }

          try {
            // Parse the JSON data into a JavaScript object
            const jsonData = JSON.parse(data);

            //console.log(JSON.stringify(jsonData));

            const customers = jsonData.AuditFile.MasterFiles[0].Customer;
            const products = jsonData.AuditFile.MasterFiles[0].Product;
            const invoices =
              jsonData.AuditFile.SourceDocuments[0].SalesInvoices[0].Invoice;
            const payments =
              jsonData.AuditFile.SourceDocuments[0].Payments[0].Payment;

            //console.log(jsonData.AuditFile.SourceDocuments[0]);

            console.log("Customers:", customers.length);

            if(customers) {
              customers.forEach(async (c) => {
                await Customer.findOne({ CustomerTaxID: c.CustomerTaxID[0] })
                  .exec()
                  .then((customer) => {
                    if (customer) {
                      console.log("Customer already exists");
                    } else {
                      const newCustomer = new Customer({
                        CustomerID: c.CustomerID[0],
                        CustomerTaxID: c.CustomerTaxID[0],
                        CompanyName: c.CompanyName[0],
                        BillingAddress: {
                          AddressDetail: c.BillingAddress[0].AddressDetail[0],
                          City: c.BillingAddress[0].City[0],
                          PostalCode: c.BillingAddress[0].PostalCode[0],
                          Country: c.BillingAddress[0].Country[0],
                        },
                        ShipToAddress: {
                          AddressDetail: c.ShipToAddress[0].AddressDetail[0],
                          City: c.ShipToAddress[0].City[0],
                          PostalCode: c.ShipToAddress[0].PostalCode[0],
                          Country: c.ShipToAddress[0].Country[0],
                        },
                      });

                      //console.log("New customer:", newCustomer);

                      newCustomer
                        .save()
                        .then((savedCustomer) => {
                          // console.log("User saved successfully:", savedCustomer);
                        })
                        .catch((error) => {
                          console.error("Error saving customer:", error);
                        });
                    }
                  })
                  .catch((error) => {
                    console.error("Error saving customer:", error);
                  });
              });
            } else {
              console.log("No customers");
            }

            if(products) {
              products.forEach((c) => {
                Product.findOne({ ProductCode: c.ProductCode[0] })
                  .exec()
                  .then((product) => {
                    if (product) {
                      console.log("Product already exists");
                    } else {
                      const newProduct = new Product({
                        ProductType: c.ProductType[0],
                        ProductCode: c.ProductCode[0],
                        ProductDescription: c.ProductDescription[0],
                        ProductNumberCode: c.ProductNumberCode[0],
                      });

                      newProduct
                        .save()
                        .then((savedProduct) => {
                          // console.log(                          "Product saved successfully:",savedProduct                );
                        })
                        .catch((error) => {
                          console.error("Error saving product:", error);
                        });
                    }
                  })
                  .catch((error) => {
                    console.error("Error saving product:", error);
                  });
              });
            } else {
              console.log("No products");
            }

            if(invoices) {
              invoices.forEach((c) => {
                Invoice.findOne({ InvoiceNo: c.InvoiceNo[0] })
                  .exec()
                  .then((invoice) => {
                    if (invoice) {
                      console.log("Invoice already exists");
                    } else {
                      const lines = [];
                      c.Line.forEach((line) => {
                        const readyLine = {
                          LineNumber: line.LineNumber[0],
                          ProductCode: line.ProductCode[0],
                          Quantity: line.Quantity[0],
                          UnitPrice: line.UnitPrice[0],
                        };

                        lines.push(readyLine);
                      });

                      //console.log(lines);

                      const newInvoice = new Invoice({
                        InvoiceNo: c.InvoiceNo[0],
                        DocumentStatus: {
                          InvoiceStatus: c.DocumentStatus[0].InvoiceStatus[0],
                        },
                        InvoiceDate: c.InvoiceDate[0],
                        CustomerID: c.CustomerID[0],

                        Line: lines,
                        DocumentTotals: {
                          TaxPayable: c.DocumentTotals[0].TaxPayable[0],
                          NetTotal: c.DocumentTotals[0].NetTotal[0],
                          GrossTotal: c.DocumentTotals[0].GrossTotal[0],
                        },
                      });

                      newInvoice
                        .save()
                        .then((savedInvoice) => {
                          //  console.log( "Invoice saved successfully:",savedInvoice);
                        })
                        .catch((error) => {
                          console.error("Error saving invoice:", error);
                        });
                    }
                  })
                  .catch((error) => {
                    console.error("Error saving invoice:", error);
                  });
              });
            } else {
              console.log("No invoices");
            }

            if(payments) {
              payments.forEach((c) => {
                //console.log(c);
                Payment.findOne({ PaymentRefNo: c.PaymentRefNo[0] })
                  .exec()
                  .then((payment) => {
                    if (payment) {
                      console.log("Payment already exists");
                    } else {
                      const lines = [];
                      c.Line.forEach((s) => {
                        const newLine = {
                          LineNumber: s.LineNumber[0],
                          SourceDocumentID: {
                            OriginatingON: s.SourceDocumentID[0].OriginatingON[0],
                            InvoiceDate: s.SourceDocumentID[0].InvoiceDate[0],
                          },
                          SettlementAmount: s.SettlementAmount[0],
                          CreditAmount: s.CreditAmount[0],
                        };

                        lines.push(newLine);
                      });

                      /*console.log(
                        c.DocumentTotals[0].Settlement[0].SettlementAmount[0]
                      );*/
                      //Se não existir, criar
                      const newPayment = new Payment({
                        PaymentRefNo: c.PaymentRefNo[0],
                        CustomerID: c.CustomerID[0],
                        Line: lines,
                        DocumentTotals: {
                          TaxPayable: c.DocumentTotals[0].TaxPayable[0],
                          NetTotal: c.DocumentTotals[0].NetTotal[0],
                          GrossTotal: c.DocumentTotals[0].GrossTotal[0],
                        },
                      });

                      newPayment
                        .save()
                        .then((savedPayment) => {
                          //  console.log(                          "Product saved successfully:",                          savedPayment                        );
                        })
                        .catch((error) => {
                          console.error("Error saving product:", error);
                        });
                    }
                  })
                  .catch((error) => {
                    console.error("Error saving payment:", error);
                  });
              });
            } else {
              console.log("No payments");
            }

            // Excluir o arquivo após o tratamento
            fs.unlink(filePath, function (err) {
              if (err) {
                console.error("Error deleting file:", err);
                return;
              }

              console.log("File deleted successfully:", filePath);
            });
          } catch (err) {
            console.error("Error parsing JSON:", err);
          }
        });
      }
    });
  });
}

function validNIF(NIF){
  var valid = false;
  if (NIF.length == 9){
    var sum = 0;
    var checkDigit = NIF[8];
    for (var i = 0; i < 8; i++){
      sum += NIF[i] * (9 - i);
    }
    var check = 11 - (sum % 11);
    if (check == 10 || check == 11){
      check = 0;
    }
    if (check == checkDigit){
      valid = true;
    }
  }
  return valid;
}

module.exports = saftController;
