const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  InvoiceNo: {
    type: String,
    required: true,
    unique: true,
  },
  DocumentStatus: {
    InvoiceStatus: {
      type: String,
      required: true,
    },
  },
  InvoiceDate: {
    type: Date,
    required: true,
  },
  CustomerID: {
    type: String,
    required: true,
  },
  
  Line: [
    {
      LineNumber: {
        type: String,
        required: true,
      },
      ProductCode: {
        type: String,
        required: true,
      },
      Quantity: {
        type: String,
        required: true,
      },
      UnitPrice: {
        type: String,
        required: true,
      },
    },
  ],
  DocumentTotals: {
    TaxPayable: {
      type: String,
      required: true,
    },
    NetTotal: {
      type: String,
      required: true,
    },
    GrossTotal: {
      type: String,
      required: true,
    },
  },
});

const Invoice = mongoose.model("Invoice", invoiceSchema);

module.exports = Invoice;
