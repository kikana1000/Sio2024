const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentSchema = new Schema({
  PaymentRefNo: {
    type: String,
    required: true,
    unique: true,
  },
  CustomerID: {
    type: String,
    required: true,
  },
  Line: [{
    LineNumber: {
      type: String,
      required: true,
    },
    SourceDocumentID: {
      OriginatingON: {
        type: String,
        required: true,
      },
      InvoiceDate: {
        type: Date,
        required: true,
      },
    },
    SettlementAmount: {
      type: String,
      required: true,
    },
    CreditAmount: {
      type: String,
      required: true,
    },
  }],
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

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
