const utils = require("./utils");
const createError = require("http-errors");

var customerController = {};

customerController.listCustomers = async function (req, res) {

  // Fiscal Year
  const fiscal_year = req.cookies.fiscal_year;
  if(!fiscal_year){
    res.redirect('error', createError(404));
    return;
  }

  // Invoices
  const invoices_BD = await utils.invoice.getInvoices_DB(fiscal_year);
  const invoicesPorcessed = await utils.invoice.processInvoices(invoices_BD);

  // Customers
  const customers_BD = await utils.customer.getCustomers_DB();

  if(!invoices_BD || invoices_BD.length == 0){
    res.render("clients/customer_list", { customers: customers_BD, fiscal_year: fiscal_year, processed: false });
    return;
  }

  // Products
  const products_BD = await utils.product.getProducts_DB();
  const products_TOC = await utils.product.getProducts_TOC();
  const products = await utils.product.processProducts(products_BD, products_TOC);

  const customers = await utils.customer.processCustomers(customers_BD, invoices_BD, products);

  //console.log(customers);

  let resume = {
    gross_total: 0,
    sales_total: 0,
    products_total: 0,
    profit_total: 0,
  }
  for (let customer of customers) {
    resume.gross_total += customer.resume.gross_total;
    resume.sales_total += customer.resume.sales;
    resume.products_total += customer.resume.products;
    resume.profit_total += customer.resume.profit;
  }

  res.render("clients/customer_list", { customers: customers, fiscal_year: fiscal_year, processed: true, resume: resume });

};

module.exports = customerController;
