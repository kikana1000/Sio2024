const Product = require("../models/Product");

const utils = require("./utils");

var productsController = {};

productsController.listProducts = async function(req, res) {

  const fiscal_year = req.cookies.fiscal_year;

  // Invoices
  const invoices = await utils.invoice.getInvoices_DB(fiscal_year)

  // Products
  const products_BD = await utils.product.getProducts_DB()
  const products_TOC = await utils.product.getProducts_TOC()
  const productsProcessed = await utils.product.processProducts(products_BD, products_TOC)
  if(!invoices || invoices.length == 0){
    console.log(`No invoices for fiscal year ${fiscal_year}`)
    return res.render("products/product_list", { products: productsProcessed, fiscal_year: fiscal_year, processed: false });
  }

  const products = await utils.calculation.calculeProfitByProduct(invoices, productsProcessed)

  //console.log(products)

  res.render("products/product_list", { products: products, fiscal_year: fiscal_year, processed: true });
};

module.exports = productsController;