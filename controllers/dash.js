const request = require("../utils/RequestUtils");
var createError = require("http-errors");

var Invoice = require("../models/Invoice");
var Payment = require("../models/Payment");
var Product = require("../models/Product");
var Customer = require("../models/Customer");
const moment = require('moment');

const utils = require("./utils");

var dashController = {};

dashController.controlFiscalYear = async function (req, res, next) {
  // Obter anos fiscais disponíveis
  let sales_graph = await request.TOC_request("/sales_graph", "GET")
  if (sales_graph.errors) {
    sales_graph = await request.TOC_request("/sales_graph", "GET")
  }

  var years = [];
  for (var i = 0; i < sales_graph.data.length; i++) {
    var year = sales_graph.data[i].attributes.year;
    if (!years.includes(year)) {
      years.push(year);
    }
  }

  const fiscal_year = parseInt(req.params.year);

  // Validar ano fiscal selecionado
  if (!years.includes(fiscal_year)) {
    res.render("error", { error: createError(404, { reason: `Não foi encontrado o ano fiscal ${fiscal_year}` }) })
    return;
  } else {

    res.cookie("fiscal_year", req.params.year)
    next();
  }
}

dashController.controlFiscalYearAfter = async function (req, res, next) {
  // Obter anos fiscais disponíveis
  let sales_graph = await request.TOC_request("/sales_graph", "GET")
  if (sales_graph.errors) {
    sales_graph = await request.TOC_request("/sales_graph", "GET")
  }

  var years = [];
  for (var i = 0; i < sales_graph.data.length; i++) {
    var year = sales_graph.data[i].attributes.year;
    if (!years.includes(year)) {
      years.push(year);
    }
  }

  const fiscal_year = parseInt(req.cookies.fiscal_year);

  // Validar ano fiscal selecionado
  if (!years.includes(fiscal_year)) {
    res.render("error", { error: createError(404, { reason: `Não foi encontrado o ano fiscal ${fiscal_year}` }) })
    return;
  } else {
    next();
  }
}


dashController.index = async function (req, res) {

  const fiscal_year = parseInt(req.params.year);

  if (!fiscal_year) {
    res.render("error", { error: createError(404, { reason: `Não foi encontrado o ano fiscal ${fiscal_year}` }) })
    return;
  }

  // Invoices
  const invoices = await utils.invoice.getInvoices_DB(fiscal_year);
  const invoicesProcessed = await utils.invoice.processInvoices(invoices);

  if (invoicesProcessed == null) {
    res.render("error", { error: createError(405, { reason: `Não foi possível processar as faturas do ano fiscal ${fiscal_year}` }) })
    return;
  }

  // Products
  const products_DB = await utils.product.getProducts_DB();
  const productsTOC = await utils.product.getProducts_TOC();
  const productsProcessed = await utils.product.processProducts(products_DB, productsTOC);

  // Profit
  const profit = await utils.calculation.calculeProfit(invoices, productsProcessed);

  // Suppliers
  const suppliers = await utils.suppliers.getSuppliers_TOC();

  // Customers
  const customers_BD = await utils.customer.getCustomers_DB();

  const sales_graph = await request.TOC_request("/sales_graph", "GET")
  let sales_graph_data = sales_graph.data.filter((data) => data.attributes.year == fiscal_year);
  if (fiscal_year == moment().year()) {
    sales_graph_data = sales_graph_data.filter((data) => data.attributes.month <= moment().month() + 1);
  }

  // Sales Graph
  let sales_graph_cumulative = await utils.calculation.calculeSalesCumulative(sales_graph, fiscal_year);
  if(fiscal_year == moment().year()){
    sales_graph_cumulative.splice(moment().month() + 1);
  }

  // Profit by product
  const products = await utils.calculation.calculeProfitByProduct(invoices, productsProcessed)
  products.sort(function (a, b) {
    return b.resume.ProductProfit - a.resume.ProductProfit;
  });
  // limit to 5 products
  if (products.length > 5) {
    products.splice(5);
  }

  // Profit by customer
  const customers = await utils.customer.processCustomers(customers_BD, invoices, productsProcessed);
  customers.sort(function (a, b) {
    // 30% gross_total + 10% gross_mean + 10% sales + 40% profit + 10% products
    var weightA = (a.resume.gross_total * 0.3) + (a.resume.gross_mean * 0.1) + (a.resume.sales * 0.1) + (a.resume.profit * 0.4) + (a.resume.products * 0.1);
    var weightB = (b.resume.gross_total * 0.3) + (b.resume.gross_mean * 0.1) + (b.resume.sales * 0.1) + (b.resume.profit * 0.4) + (b.resume.products * 0.1);

    // Classificação com base no valor ponderado
    return weightB - weightA;
  });
  // limit to 5 customers
  if (customers.length > 5) {
    customers.splice(5);
  }

  // Profit by customer by product
  const profitByCustomerByProduct = await utils.calculation.calculeProfitByCustomerByProduct(invoices, productsProcessed);
  // sort by CustomerSales desc, tiebreaker sum ProductQuantity on products array desc
  profitByCustomerByProduct.sort(function (a, b) {
    var weightA = a.resume.CustomerSales;
    var weightB = b.resume.CustomerSales;

    // Sort by CustomerSales in descending order
    if (weightA !== weightB) {
      return weightB - weightA;
    } else {
      // Sort by sum of ProductQuantity in products array in descending order as tiebreaker
      var sumA = a.products.reduce(function (acc, product) {return acc + product.ProductQuantity;}, 0);
      var sumB = b.products.reduce(function (acc, product) {return acc + product.ProductQuantity;}, 0);
      return sumB - sumA;
    }
  });
  // limit to 5
  if (profitByCustomerByProduct.length > 5) {
    profitByCustomerByProduct.splice(5);
  }

  // #Sales Monthly
  const salesMonthly = await utils.calculation.calculeSalesMonthly(fiscal_year, invoices, sales_graph);
  if (fiscal_year == moment().year()) {
    salesMonthly.splice(moment().month() + 1);
  }
  const salesMonthlyCumulative = await utils.calculation.calculeSalesMonthlyCumulative(salesMonthly);

  // Render
  const data = {
    fiscal_year: fiscal_year,
    blocks: {
      gross_total: invoicesProcessed.invoices.sum.GrossTotal || 0,
      profit_total: profit || 0,
      iva_total: invoicesProcessed.invoices.sum.TaxPayable || 0,
      sales_total: invoicesProcessed.invoices.count || 0,
      customers_billed: invoicesProcessed.customers.count || 0,
      products_billed: invoicesProcessed.products.quantity || 0,
    },
    chart: {
      graph_data: sales_graph_data || [],
      graph_cumulative: sales_graph_cumulative || [],
    },
    ranking: {
      products: products || [],
      customers: customers || [],
    },
    miniCharts: {
      profitByCustomerByProduct: profitByCustomerByProduct || [],
      salesMonthly: salesMonthly || [],
      salesMonthlyCumulative: salesMonthlyCumulative || [],
    },
  }

  res.render("dash", data);
};

module.exports = dashController;
