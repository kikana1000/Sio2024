const utils = require("./utils");
const createError = require("http-errors");

var supplierController = {};

supplierController.listSuppliers = async function (req, res) {

    const fiscal_year = req.cookies.fiscal_year;

    try {
        let suppliers = await utils.suppliers.getSuppliers_TOC();
        if (suppliers.errors) {
            suppliers = await utils.suppliers.getSuppliers_TOC();
        }

        //console.log(suppliers.data);
        return res.render("suppliers/suppliers_list", { suppliers: suppliers, fiscal_year: fiscal_year });
    } catch (e) {
        console.log(e);
        return res.render('error', createError(500, { reason: "Não foi possível carregar os dados." }));
    }
};

module.exports = supplierController;