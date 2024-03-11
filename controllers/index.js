var request = require('../utils/RequestUtils');
var moment = require('moment');
var createError = require("http-errors");
var { exec } = require('child_process');

var indexController = {};

indexController.index = async function (req, res) {

    const sales_graph = await request.TOC_request("/sales_graph", "GET")
    
    let count = 0;
    while (sales_graph.errors && count < 3) {
        sales_graph = await request.TOC_request("/sales_graph", "GET")
        count++;
    }

    if (count == 3) {
        return res.render('error', createError(405, {reason: "Não foi possível carregar os dados."}));
    }

    try {
        var years = [];
        for (var i = 0; i < sales_graph.data.length; i++) {
            var year = sales_graph.data[i].attributes.year;
            if (!years.includes(year)) {
                years.push(year);
            }
        }

        if (years.length == 0) {
            return res.render('error', createError(405, {reason: "Não foi possível carregar os dados."}));
        }
        
        return res.render("index", { years: years });
    } catch (e) {
        return res.render('error', createError(500, {reason: "Não foi possível carregar os dados."}));
    }
};

module.exports = indexController;