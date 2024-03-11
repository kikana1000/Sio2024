const moment = require('moment');
const request = require("../utils/RequestUtils");

const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { parse } = require('querystring');


//#region Invoices

async function getInvoices_DB(fiscal_year) {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Find invoices in MongoDB.`);

    /* 
    Obter faturas na BD:
      1. data de emissão >= 1 de janeiro do ano fiscal
      2. data de emissão <= 31 de dezembro do ano fiscal
      3. InvoiceStatus != "A" (anulado)
    */
    const invoices = await Invoice.find({
        "InvoiceStatus": { $ne: "A" },
        "InvoiceDate": {
            $gte: new Date(fiscal_year, 0, 1),
            $lte: new Date(fiscal_year, 11, 31)
        }
    });

    //console.log(invoices)

    return invoices;

}

async function processInvoices(invoices) {

    if (invoices.length == 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No invoices found.`);
        return;
    }

    // calcular valores das faturas e dos produtos
    let fiscalYear = null;
    let totalDocuments = 0;
    let totalTaxPayable = 0;
    let totalNetTotal = 0;
    let totalGrossTotal = 0;
    let totalQuantity = 0;
    let totalPrice = 0;

    for (let i = 0; i < invoices.length; i++) {
        if (invoices[i].DocumentStatus.InvoiceStatus === 'A') {
            continue;
        }
        totalTaxPayable += parseFloat(invoices[i].DocumentTotals.TaxPayable);
        totalNetTotal += parseFloat(invoices[i].DocumentTotals.NetTotal);
        totalGrossTotal += parseFloat(invoices[i].DocumentTotals.GrossTotal);
        totalDocuments += 1;

        for (let j = 0; j < invoices[i].Line.length; j++) {
            totalQuantity += parseFloat(invoices[i].Line[j].Quantity);
            totalPrice += parseFloat(invoices[i].Line[j].UnitPrice);
        }

        const invoiceYear = new Date(invoices[i].InvoiceDate).getFullYear();
        if (!fiscalYear) {
            fiscalYear = invoiceYear;
        } else if (invoiceYear < fiscalYear) {
            fiscalYear = invoiceYear;
        }
    }

    let meanTaxPayable = totalTaxPayable / totalDocuments;
    let meanNetTotal = totalNetTotal / totalDocuments;
    let meanGrossTotal = totalGrossTotal / totalDocuments;

    // obter clientes que compraram
    let customers = [];
    for (let i = 0; i < invoices.length; i++) {
        if (invoices[i].DocumentStatus.InvoiceStatus === 'A') {
            continue;
        }
        if (!customers.includes(invoices[i].CustomerID)) {
            customers.push(invoices[i].CustomerID);
        }
    }

    // construir objeto com os resultados
    let result = {
        fiscal_year: fiscalYear,
        invoices: {
            count: totalDocuments,
            sum: {
                TaxPayable: parseFloat(totalTaxPayable.toFixed(4)),
                NetTotal: parseFloat(totalNetTotal.toFixed(4)),
                GrossTotal: parseFloat(totalGrossTotal.toFixed(4))
            },
            mean: {
                TaxPayable: parseFloat(meanTaxPayable.toFixed(4)),
                NetTotal: parseFloat(meanNetTotal.toFixed(4)),
                GrossTotal: parseFloat(meanGrossTotal.toFixed(4))
            }
        },
        products: {
            quantity: totalQuantity,
            price: parseFloat(totalPrice.toFixed(4))
        },
        customers: {
            count: customers.length,
        }
    };

    return result;
}

//#endregion

//#region Products

async function getProducts_DB() {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Find products in MongoDB.`);
    const products = await Product.find({});
    return products;

}

async function getProducts_TOC() {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Find products in TOCOline.`);
    const products = await request.TOC_request("/products", "GET");
    return products;

}

async function processProducts(products_DB, products_TOC) {

    if (products_DB.length == 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No products found.`);
        return;
    }

    const newProducts = [];

    for (const productDB of products_DB) {
        for (const productTOC of products_TOC.data) {
            if (productDB.ProductCode === productTOC.attributes.item_code) {
                const newProduct = {
                    ProductType: productDB.ProductType,
                    ProductCode: productDB.ProductCode,
                    ProductDescription: productDB.ProductDescription,
                    ProductNumberCode: productDB.ProductNumberCode,
                    sales_price: productTOC.attributes.sales_price,
                    purchase_price: productTOC.attributes.purchase_price,
                    sales_price_vat_display: productTOC.attributes.sales_price_vat_display,
                    tax_code: productTOC.attributes.tax_code
                };
                newProducts.push(newProduct);
                break;
            }
        }
    }

    const productCodes = new Set(newProducts.map(product => product.ProductCode));

    for (const product of products_DB) {
        if (product.ProductType === 'P' && !productCodes.has(product.ProductCode)) {
            const newProduct = {
                ProductType: product.ProductType,
                ProductCode: product.ProductCode,
                ProductDescription: product.ProductDescription,
                ProductNumberCode: product.ProductNumberCode,
                sales_price: 0,
                purchase_price: 0,
                sales_price_vat_display: 0,
                tax_code: 0
            };
            newProducts.push(newProduct);
        }
    }

    return newProducts;

}

//#endregion

//#region Suppliers

async function getSuppliers_TOC() {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Find suppliers in TOCOline.`);
    let suppliers = await request.TOC_request("/suppliers", "GET");
    if (suppliers.errors) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Error finding suppliers in TOCOline.`);
        return;
    }
    suppliers = suppliers.data;

    // Get address of each supplier
    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Find addresses of suppliers in TOCOline.`);
    const addresses = await request.TOC_request("/addresses", "GET");

    // Get contacts
    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Find contacts of suppliers in TOCOline.`);
    const contacts = await request.TOC_request("/contacts", "GET");

    let newSuppliers = [];
    for (let supplier of suppliers) {
        if (supplier.attributes.tax_registration_number === '999999990') {
            continue;
        }
        let index_a = addresses.data.findIndex(address => address.id === supplier.relationships.addresses.data[0].id);
        let index_c = contacts.data.findIndex(contact => contact.id === supplier.relationships.contacts.data[0].id);

        const address = addresses.data[index_a].attributes;
        const contact = contacts.data[index_c].attributes;

        const newSupplier = {
            ...supplier.attributes,
            id: supplier.id,
            address: {
                address: address.address_detail,
                city: address.city,
                postalcode: address.postcode
            },
            contact: {
                name: contact.name,
                position: contact.position,
                email: contact.email,
                phone: contact.phone_number,
                mobile: contact.mobile_number
            }
        };

        newSuppliers.push(newSupplier);
    }

    return newSuppliers;

}

//#endregion

//#region Customers

async function getCustomers_DB() {

    //Get customers in MongoDB
    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Find customers in MongoDB.`);
    const customers = await Customer.find({});

    //Get customers in TOCOnline
    const customers_TOC = await getCustomers_TOC();

    //Get addresses in TOCOnline
    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Find addresses of customers in TOCOline.`);
    const addresses = await request.TOC_request("/addresses", "GET");

    for (let customer of customers) {
        //Find customer in TOCOnline
        let index = customers_TOC.data.findIndex(c => c.attributes.tax_registration_number === customer.CustomerTaxID);

        if (index === -1) {
            continue;
        }

        //Find address of customer in TOCOnline
        let address = addresses.data.find(address => address.id === customers_TOC.data[index].relationships.addresses.data[0].id);

        customer.ShipToAddress = {
            AddressDetail: address.attributes.address_detail,
            City: address.attributes.city,
            PostalCode: address.attributes.postcode,
            Country: customer.ShipToAddress.Country
        };
    }

    return customers;

}

async function getCustomers_TOC() {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Find customers in TOCOline.`);
    const customers = await request.TOC_request("/customers", "GET");
    return customers;

}

async function processCustomers(customers_DB, invoices, productsProcessed) {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Processing customers...`);

    if (customers_DB.length == 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No customers found.`);
        return;
    }

    const newCustomers = [];

    for (const invoice of invoices) {
        if (invoice.DocumentStatus.InvoiceStatus === 'A') {
            continue;
        }

        let gross_total = parseFloat(invoice.DocumentTotals.GrossTotal) || 0;

        let qnt_products = 0;
        for (const line of invoice.Line) {
            // increment number of products with cast to int
            qnt_products += parseInt(line.Quantity);
        }

        // determine profit with the products processed
        let profitLine = 0;
        for (const line of invoice.Line) {
            let product = productsProcessed.find(product => product.ProductCode === line.ProductCode);
            if (product) {
                profitLine += await profit(product.sales_price_vat_display, product.purchase_price, line.Quantity);
            }
        }

        let index = newCustomers.findIndex(customer => customer.CustomerID === invoice.CustomerID);
        if (index === -1) {
            let customer = customers_DB.find(customer => customer.CustomerID === invoice.CustomerID);
            if (!customer) {
                continue;
            }
            let newCustomer = {
                ...customer._doc,
                resume: {
                    gross_total: gross_total,
                    gross_mean: 0,
                    sales: 1,
                    profit: parseFloat(profitLine.toFixed(2)),
                    products: qnt_products
                }
            };
            newCustomers.push(newCustomer);
        } else {
            newCustomers[index].resume.gross_total += gross_total;
            newCustomers[index].resume.sales += 1;
            newCustomers[index].resume.products += qnt_products;
            newCustomers[index].resume.profit += parseFloat(profitLine.toFixed(2));
        }
    }

    for (const newCustomer of newCustomers) {
        newCustomer.resume.gross_mean = newCustomer.resume.gross_total / newCustomer.resume.sales;
    }


    //console.log(newCustomers)

    return newCustomers;

}

//#endregion

//#region Calculations

/**
 * Calculates the profit of the company
 * 
 * Formula: profit = sum of (sales_price_vat_display - purchase_price) * quantity
 * 
 * @param {[Object]} invoices list of invoices
 * @param {[Object]} productsProcessed list of products with prices (sales_price, purchase_price, sales_price_vat_display)
 * 
 * @returns profit of the company
 */
async function calculeProfit(invoices, productsProcessed) {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Calculating profit...`);

    if (invoices.length == 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No invoices found.`);
        return;
    }

    let profit = 0;
    let iva = 0;

    for (let i = 0; i < invoices.length; i++) {
        if (invoices[i].DocumentStatus.InvoiceStatus === 'A') {
            continue;
        }
        for (let j = 0; j < invoices[i].Line.length; j++) {
            let product = productsProcessed.find(product => product.ProductCode === invoices[i].Line[j].ProductCode);
            if (product) {
                profit += (parseFloat(product.sales_price_vat_display) - parseFloat(product.purchase_price)) * parseFloat(invoices[i].Line[j].Quantity);
                iva += (parseFloat(product.sales_price) - parseFloat(product.sales_price_vat_display)) * parseFloat(invoices[i].Line[j].Quantity);
            }
        }
    }

    return profit;

}

async function calculeProfitByProduct(invoices, productsProcessed) {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Calculating profit by product...`);

    if (invoices.length == 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No invoices found.`);
        return;
    }

    let profitByProduct = [];

    for (let i = 0; i < invoices.length; i++) {
        if (invoices[i].DocumentStatus.InvoiceStatus === 'A') {
            continue;
        }
        for (let j = 0; j < invoices[i].Line.length; j++) {
            let product = productsProcessed.find(product => product.ProductCode === invoices[i].Line[j].ProductCode);
            if (product) {
                let index = profitByProduct.findIndex(product => product.ProductCode === invoices[i].Line[j].ProductCode);
                if (index == -1) {
                    let tax_data = 0;
                    switch (product.tax_code) {
                        case 'RED':
                            tax_data = 6;
                            break;
                        case 'INT   ':
                            tax_data = 13;
                            break;
                        case 'NOR':
                            tax_data = 23;
                            break;
                        default:
                            tax_data = 0;
                            break;
                    }

                    let newProduct = {
                        //Infos
                        info: {
                            ProductType: product.ProductType,
                            ProductCode: product.ProductCode,
                            ProductDescription: product.ProductDescription
                        },
                        //Prices
                        price: {
                            ProductPVP: product.sales_price,
                            ProductTaxValue: tax_data,
                            ProductPU: product.sales_price_vat_display,
                            ProductPC: product.purchase_price
                        },
                        //Calculations
                        resume: {
                            ProductBilled: (product.sales_price * parseFloat(invoices[i].Line[j].Quantity)),
                            ProductQuantity: parseInt(invoices[i].Line[j].Quantity),
                            ProductProfit: await profit(product.sales_price_vat_display, product.purchase_price, invoices[i].Line[j].Quantity),
                            ProductIVA: await iva(product.sales_price, product.sales_price_vat_display, invoices[i].Line[j].Quantity)
                        }
                    };
                    profitByProduct.push(newProduct);
                } else {
                    profitByProduct[index].resume.ProductBilled += (parseFloat(invoices[i].Line[j].UnitPrice) * parseFloat(invoices[i].Line[j].Quantity));
                    profitByProduct[index].resume.ProductQuantity += parseInt(invoices[i].Line[j].Quantity);
                    profitByProduct[index].resume.ProductProfit += await profit(product.sales_price_vat_display, product.purchase_price, invoices[i].Line[j].Quantity);
                    profitByProduct[index].resume.ProductIVA += await iva(product.sales_price, product.sales_price_vat_display, invoices[i].Line[j].Quantity);
                }
            }
        }
    }

    return profitByProduct;

}

/**
 * Calculates the profit of the company
 * 
 * Formula: profit = sum of (sales_price_vat_display - purchase_price) * quantity
 * 
 * @param {[Object]} invoices list of invoices
 * @param {[Object]} productsProcessed list of products with prices (sales_price, purchase_price, sales_price_vat_display)
 * 
 * @returns profit of the customer
 */
async function calculeProfitByCustomer(invoices, productsProcessed) {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Calculating profit by customer...`);

    if (invoices.length == 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No invoices found.`);
        return;
    }

    let profitByCustomer = [];

    for (let i = 0; i < invoices.length; i++) {
        let index = profitByCustomer.findIndex(customer => customer.CustomerCode === invoices[i].CustomerID);
        if (index == -1) {
            const customer = await Customer.findOne({ CustomerID: invoices[i].CustomerID });
            let newCustomer = {
                CustomerCode: customer.CustomerID,
                CustomerTaxID: customer.CustomerTaxID,
                CustomerName: customer.CompanyName,
                profit: 0,
                iva: 0
            };
            for (let j = 0; j < invoices[i].Line.length; j++) {
                let product = productsProcessed.find(product => product.ProductCode === invoices[i].Line[j].ProductCode);
                if (product) {
                    newCustomer.profit += (parseFloat(product.sales_price_vat_display) - parseFloat(product.purchase_price)) * parseFloat(invoices[i].Line[j].Quantity);
                    newCustomer.iva += (parseFloat(product.sales_price) - parseFloat(product.sales_price_vat_display)) * parseFloat(invoices[i].Line[j].Quantity);
                }
            }
            profitByCustomer.push(newCustomer);
        } else {
            for (let j = 0; j < invoices[i].Line.length; j++) {
                let product = productsProcessed.find(product => product.ProductCode === invoices[i].Line[j].ProductCode);
                if (product) {
                    profitByCustomer[index].profit += (parseFloat(product.sales_price_vat_display) - parseFloat(product.purchase_price)) * parseFloat(invoices[i].Line[j].Quantity);
                    profitByCustomer[index].iva += (parseFloat(product.sales_price) - parseFloat(product.sales_price_vat_display)) * parseFloat(invoices[i].Line[j].Quantity);
                }
            }
        }
    }

    return profitByCustomer;

}

async function calculeProfitByCustomerByProduct(invoices, productsProcessed) {
    // ToDo
    // 1. Get all invoices
    // 2. Get all products
    // 3. Get all customers
    // 4. For each invoice, get the customer
    // 5. For each invoice in line, get the product
    // 6. Calculate the profit of the product
    // 7. Calculate the iva of the product
    // 8. Calculate the profit of the customer
    // 9. Calculate the iva of the customer
    // 10. Return the list of customers with the profit and iva
    /*
    Format of the return:
    [
        {
            info: {
                CustomerCode: 'C0001',
                CustomerTaxID: '123456789',
                CustomerName: 'Customer Name'
            },
            products: [
                {
                    info: {
                        ProductType: 'P',
                        ProductCode: 'P0001',
                        ProductDescription: 'Product Description'
                    },
                    prices: {
                        ProductPVP: 10,
                        ProductTaxValue: 6,
                        ProductPU: 8.13,
                        ProductPC: 5
                    },
                    resume: {
                        ProductBilled: 100,
                        ProductQuantity: 10,
                        ProductProfit: 100,
                        ProductIVA: 100
                    }
                },
                {
                    info: {
                        ProductType: 'P',
                        ProductCode: 'P0002',
                        ProductDescription: 'Product Description',
                        ProductPVP: 10,
                        ProductTaxValue: 6,
                        ProductPU: 8.13,
                        ProductPC: 5
                    },
                    resume: {
                        ProductBilled: 100,
                        ProductQuantity: 10,
                        ProductProfit: 100,
                        ProductIVA: 100
                    }
                }
            ],
            resume: {
                CustomerBilled: 100,
                CustomerProfit: 100,
                CustomerIVA: 100
                CustomerSales: 1
            }
        },
    ]

    */

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Calculating profit by customer by product...`);

    if (invoices.length == 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No invoices found.`);
        return;
    }

    let profitByCustomerByProduct = [];

    for (let invoice of invoices) {
        // If invoice status is 'A', skip it
        if (invoice.DocumentStatus.InvoiceStatus == 'A') {
            continue;
        }

        // Find index of the customer in the array
        let customerIndex = profitByCustomerByProduct.findIndex(customer => customer.info.CustomerID === invoice.CustomerID);

        // If customer is not in the array, add it
        if (customerIndex == -1) {
            // Find customer in the customers array
            const customer = await Customer.findOne({ CustomerID: invoice.CustomerID });

            // New customer
            let newCustomer = {
                info: {
                    CustomerID: customer.CustomerID,
                    CustomerTaxID: customer.CustomerTaxID,
                    CustomerName: customer.CompanyName
                },
                products: [],
                resume: {
                    CustomerBilled: 0,
                    CustomerProfit: 0,
                    CustomerIVA: 0,
                    CustomerSales: 0
                }
            };

            for (let line of invoice.Line) {
                // Find index of the product in the array
                let productIndex = newCustomer.products.findIndex(product => product.info.ProductCode === line.ProductCode);

                // If product is not in the array, add it
                if (productIndex == -1) {
                    // Find product in the productsProcessed array
                    let product = productsProcessed.find(product => product.ProductCode === line.ProductCode);

                    // New product
                    let newProduct = {
                        info: {
                            ProductType: product.ProductType,
                            ProductCode: product.ProductCode,
                            ProductDescription: product.ProductDescription
                        },
                        prices: {
                            ProductPVP: parseFloat(product.sales_price.toFixed(2)),
                            ProductTaxCode: product.tax_code,
                            ProductPU: parseFloat(product.sales_price_vat_display.toFixed(2)),
                            ProductPC: parseFloat(product.purchase_price.toFixed(2)),
                            ProductProfitEstimation: parseFloat((product.sales_price_vat_display - product.purchase_price).toFixed(2))
                        },
                        resume: {
                            ProductBilled: parseFloat((product.sales_price_vat_display * line.Quantity).toFixed(2)),
                            ProductQuantity: parseInt(line.Quantity),
                            ProductProfit: parseFloat((await profit(product.sales_price_vat_display, product.purchase_price, line.Quantity)).toFixed(2)),
                            ProductIVA: parseFloat((await iva(product.sales_price, product.sales_price_vat_display, line.Quantity)).toFixed(2))
                        }
                    };
                    // Add product to the customer
                    newCustomer.products.push(newProduct);

                    // If product is in the array, update it
                } else {
                    // Find product in the productsProcessed array
                    let product = productsProcessed.find(product => product.ProductCode === line.ProductCode);

                    // Update product
                    newCustomer.products[productIndex].resume.ProductBilled += parseFloat(product.sales_price_vat_display.toFixed(2) * line.Quantity.toFixed(2)).toFixed(2);
                    newCustomer.products[productIndex].resume.ProductQuantity += parseInt(line.Quantity);
                    newCustomer.products[productIndex].resume.ProductProfit += parseFloat((await profit(product.sales_price_vat_display, product.purchase_price, line.Quantity)).toFixed(2));
                    newCustomer.products[productIndex].resume.ProductIVA += parseFloat((await iva(product.sales_price, product.sales_price_vat_display, line.Quantity)).toFixed(2));
                }
            }

            // Update customer
            for (let product of newCustomer.products) {
                newCustomer.resume.CustomerProfit += parseFloat(product.resume.ProductProfit.toFixed(2));
            }
            newCustomer.resume.CustomerBilled += parseFloat(invoice.DocumentTotals.NetTotal);
            newCustomer.resume.CustomerIVA += parseFloat(invoice.DocumentTotals.TaxPayable);
            newCustomer.resume.CustomerSales++;

            // Add customer to the array
            profitByCustomerByProduct.push(newCustomer);

            // If customer is in the array, add the product to the customer
        } else {

            for (let line of invoice.Line) {

                let productIndex = profitByCustomerByProduct[customerIndex].products.findIndex(product => product.info.ProductCode === line.ProductCode);

                // If product is not in the array, add it
                if (productIndex == -1) {
                    // Find product in the productsProcessed array
                    let product = productsProcessed.find(product => product.ProductCode === line.ProductCode);

                    // New product
                    let newProduct = {
                        info: {
                            ProductType: product.ProductType,
                            ProductCode: product.ProductCode,
                            ProductDescription: product.ProductDescription
                        },
                        prices: {
                            ProductPVP: parseFloat(product.sales_price.toFixed(2)),
                            ProductTaxCode: product.tax_code,
                            ProductPU: parseFloat(product.sales_price_vat_display.toFixed(2)),
                            ProductPC: parseFloat(product.purchase_price.toFixed(2)),
                            ProductProfitEstimation: parseFloat((product.sales_price_vat_display - product.purchase_price).toFixed(2))

                        },
                        resume: {
                            ProductBilled: parseFloat((product.sales_price_vat_display * line.Quantity).toFixed(2)),
                            ProductQuantity: parseInt(line.Quantity),
                            ProductProfit: parseFloat((await profit(product.sales_price_vat_display, product.purchase_price, line.Quantity)).toFixed(2)),
                            ProductIVA: parseFloat((await iva(product.sales_price, product.sales_price_vat_display, line.Quantity)).toFixed(2))
                        }
                    };
                    // Add product to the customer
                    profitByCustomerByProduct[customerIndex].products.push(newProduct);

                    // If product is in the array, update it
                } else {
                    // Find product in the productsProcessed array
                    let product = productsProcessed.find(product => product.ProductCode === line.ProductCode);

                    // Update product
                    profitByCustomerByProduct[customerIndex].products[productIndex].resume.ProductBilled += parseFloat(product.sales_price_vat_display.toFixed(2) * line.Quantity).toFixed(2);
                    profitByCustomerByProduct[customerIndex].products[productIndex].resume.ProductQuantity += parseInt(line.Quantity);
                    profitByCustomerByProduct[customerIndex].products[productIndex].resume.ProductProfit += parseFloat((await profit(product.sales_price_vat_display, product.purchase_price, line.Quantity)).toFixed(2));
                    profitByCustomerByProduct[customerIndex].products[productIndex].resume.ProductIVA += parseFloat((await iva(product.sales_price, product.sales_price_vat_display, line.Quantity)).toFixed(2));
                }
            }

            // Update customer
            for (let product of profitByCustomerByProduct[customerIndex].products) {
                profitByCustomerByProduct[customerIndex].resume.CustomerProfit += parseFloat(product.resume.ProductProfit).toFixed(2);
            }
            profitByCustomerByProduct[customerIndex].resume.CustomerBilled += parseFloat(invoice.DocumentTotals.NetTotal);
            profitByCustomerByProduct[customerIndex].resume.CustomerIVA += parseFloat(invoice.DocumentTotals.TaxPayable);
            profitByCustomerByProduct[customerIndex].resume.CustomerSales++;
        }

    }

    // Sort customers by CustomerBilled
    profitByCustomerByProduct.sort((a, b) => (a.resume.CustomerBilled < b.resume.CustomerBilled) ? 1 : -1);

    // Sort products by ProductBilled
    for (let customer of profitByCustomerByProduct) {
        customer.products.sort((a, b) => (a.resume.ProductBilled < b.resume.ProductBilled) ? 1 : -1);
    }

    // Return the array
    return profitByCustomerByProduct;

}

async function calculeSalesCumulative(sales_graph, fiscal_year) {
    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Calculating sales cumulative...`);

    if (sales_graph.data.length === 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No sales found.`);
        return;
    }

    let sales_cumulative = [];

    let cumulativeNetTotal = 0;
    let cumulativeGrossTotal = 0;

    for (const salesData of sales_graph.data) {
        const { year, month, net_total, gross_total } = salesData.attributes;

        if (year === fiscal_year) {
            cumulativeNetTotal += net_total;
            cumulativeGrossTotal += gross_total;

            const cumulativeData = {
                year,
                month,
                cumulative_net_total: cumulativeNetTotal,
                cumulative_gross_total: cumulativeGrossTotal,
            };

            sales_cumulative.push(cumulativeData);
        }
    }

    return sales_cumulative;
}

async function calculeSalesMonthly(fiscal_year, invoices, sales_graph) {

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Calculating sales by product monthly...`);

    if (invoices.length === 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No invoices found.`);
        return;
    }

    let sales_monthly = [];

    for (const invoice of invoices) {
        if (invoice.DocumentStatus.InvoiceStatus === 'A') continue;

        const year = invoice.InvoiceDate.getFullYear();
        const month = invoice.InvoiceDate.getMonth() + 1;

        if (year === fiscal_year) {

            const index = sales_monthly.findIndex(salesData => salesData.year === year && salesData.month === month);

            if (index === -1) {
                const salesData = {
                    year: year,
                    month: month,
                    sales: 1,
                    products: invoice.Line.reduce((accumulator, line) => accumulator + parseInt(line.Quantity), 0)
                };

                sales_monthly.push(salesData);
            } else {
                sales_monthly[index].sales++;
                sales_monthly[index].products += invoice.Line.reduce((accumulator, line) => accumulator + parseInt(line.Quantity), 0);
            }
        }
    }

    // add the missing months
    for (let i = 1; i <= 12; i++) {
        const index = sales_monthly.findIndex(salesData => salesData.year === fiscal_year && salesData.month === i);

        if (index === -1) {
            const salesData = {
                year: fiscal_year,
                month: i,
                sales: 0,
                products: 0
            };

            sales_monthly.push(salesData);
        }
    }

    // Sort sales by year and month
    sales_monthly.sort((a, b) => (a.year > b.year) ? 1 : (a.year === b.year) ? ((a.month > b.month) ? 1 : -1) : -1);

    return sales_monthly;

}

async function calculeSalesMonthlyCumulative(salesMonthly) {

    //1. Iterate through the salesMonthly array
    //2. For each month, sum the sales and products of the previous months
    //3. Add the cumulative sales and products to the salesMonthlyCumulative array

    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Calculating sales by product monthly cumulative...`);

    if (salesMonthly.length === 0) {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] No sales found.`);
        return;
    }

    let salesMonthlyCumulative = [];

    let cumulativeSales = 0;
    let cumulativeProducts = 0;

    for (const salesData of salesMonthly) {
        const { year, month, sales, products } = salesData;

        cumulativeSales += sales;
        cumulativeProducts += products;

        const cumulativeData = {
            year,
            month,
            cumulative_sales: cumulativeSales,
            cumulative_products: cumulativeProducts,
        };

        salesMonthlyCumulative.push(cumulativeData);
    }

    return salesMonthlyCumulative;

}

//#endregion

//#region Usal

/**
 * Função que calcula o lucro de um produto
 * 
 * Fórmula: (preço de venda - preço de compra) * quantidade
 * 
 * @param { Number } price_sale_vat_display preço de venda SEM iva
 * @param { Number } price_purchase preço de compra SEM iva
 * @param { Number } quantity quantidade de produtos (default: 1)
 * 
 * @returns lucro do produto
 */
async function profit(price_sale_vat_display, price_purchase, quantity = 1) {
    return (parseFloat(price_sale_vat_display) - parseFloat(price_purchase)).toFixed(2) * parseFloat(quantity).toFixed(2);
}

/**
 * Função que calcula o iva de um produto
 * 
 * Fórmula: (preço de venda COM iva - preço de venda SEM iva) * quantidade
 * 
 * @param { Number } price_sale preço de venda COM iva
 * @param { Number } price_sale_vat_display preço de venda SEM iva
 * @param { Number } quantity quantidade de produtos (default: 1)
 * 
 * @returns iva do produto
 */
async function iva(price_sale, price_sale_vat_display, quantity = 1) {
    return (parseFloat(price_sale) - parseFloat(price_sale_vat_display)).toFixed(2) * parseFloat(quantity).toFixed(2);
}

//#endregion


module.exports = {
    invoice: {
        getInvoices_DB,
        processInvoices
    },
    product: {
        getProducts_DB,
        getProducts_TOC,
        processProducts
    },
    suppliers: {
        getSuppliers_TOC
    },
    customer: {
        getCustomers_DB,
        getCustomers_TOC,
        processCustomers
    },
    calculation: {
        calculeProfit,
        calculeProfitByProduct,
        calculeProfitByCustomer,
        calculeProfitByCustomerByProduct,
        calculeSalesCumulative,
        calculeSalesMonthly,
        calculeSalesMonthlyCumulative
    },
    usal: {
        profit,
        iva
    }
}