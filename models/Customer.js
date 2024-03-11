const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  CustomerID: {
    type: String,
    required: true,
  },
  AccountID: {
    type: String,
    default: "Desconhecido",
  },
  CustomerTaxID: {
    type: String,
    required: true,
    unique: true,
  },
  CompanyName: {
    type: String,
    required: true,
  },
  BillingAddress: {
    AddressDetail: {
      type: String,
      default: "Desconhecido",
    },
    City: {
      type: String,
      required: true,
    },
    PostalCode: {
      type: String,
      required: true,
    },
    Country: {
      type: String,
      required: true,
    },
  },
  ShipToAddress: {
    AddressDetail: {
      type: String,
      default: "Desconhecido",
    },
    City: {
      type: String,
      required: true,
    },
    PostalCode: {
      type: String,
      required: true,
    },
    Country: {
      type: String,
      required: true,
    },
  },
  SelfBillingIndicator: {
    type: Number,
    default: 0,
  },
});

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
