const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  ProductType: {
    type: String,
    required: true,
  },
  ProductCode: {
    type: String,
    required: true,
    unique: true,
  },
  ProductDescription: {
    type: String,
    required: true,
  },
  ProductNumberCode: {
    type: String,
    required: true,
  },
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
