'use strict';

const fs = require('fs');
const steem = require('steem');

let config_file = "config.json";
let config = null;
let payees = null;
let payments = 0;
let payment_failures = 0;
let payments_amount = 0;
let simulate = false;

function startup() {
    if(process.argv[2] == 'simulate'){
        simulate = true;
    }

    loadConfig();
    loadPayoutFile();

    steem.api.setOptions({ transport: 'http', uri: config.rpc_node, url: config.rpc_node });

    checkPayeesNames();
    checkFundsRequired();
}


function loadConfig() {
    try {
        config = JSON.parse(fs.readFileSync(config_file));
    }
    catch(err) {
        console.log("ERROR: Unable to read config.json file");
        process.exit();
    }
}


function loadPayoutFile() {
    try {
        payees = JSON.parse(fs.readFileSync(config.payout_file));
    }
    catch(err) {
        console.log("ERROR: Unable to read payout.json file");
        process.exit();
    }
}


function getTotalFundsRequired() {
    let totalFundsRequired = 0;

    for (let i = 0; i < payees.length; i++) {
        totalFundsRequired += payees[i]['Amount'];
    }

    return totalFundsRequired;
}


function checkPayeesNames() {
    let accountNames = [];

    for (let i = 0; i < payees.length; i++) {
        accountNames.push(payees[i]['Player']);
    }

    steem.api.lookupAccountNames(accountNames, function(err, result) {
        for (let i = 0; i < payees.length; i++) {
            if(!result[i]) {
                console.log('ERROR: Player @' + payees[i]['Player'] + ' does not exist.\nExiting...');
                process.exit();
            }
        }
    });

}


function printSummary() {
    console.log('--Payouts Complete--\n' + '\nTotal Payouts(' + payments + '): ' + payments_amount + ' ' + config.payout_currency + '\nFailed: ' + payment_failures);
}


function checkFundsRequired() {
    let sbd_balance = null
    let steem_balance = null
    let fundsRequired = getTotalFundsRequired()

    steem.api.getAccounts([config.payout_account], function(err, result) {     
        sbd_balance = result[0]['sbd_balance'].split(" ", 1)[0]
        steem_balance = result[0]['balance'].split(" ", 1)[0]

        console.log('@' + config.payout_account + ' balance: ' + steem_balance + ' STEEM' + ' ' + sbd_balance + ' SBD')
        console.log(fundsRequired + ' ' + config.payout_currency + ' required for payout.\n')

        if(config.payout_currency == "SBD") {
            if(sbd_balance <= fundsRequired) {
                console.log("Not enough funds to payout");
                process.exit("Not enough funds to payout\nExiting...");
            }
        }
        else if(config.payout_currency == "STEEM") {
            if(steem_balance <= fundsRequired) {
                console.log("Not enough funds to payout\nExiting...");
                process.exit(1);
            }
        }
        else {
            console.log("Invalid Currency\nExiting...");
            process.exit();    
        }

        processPayouts();       
    });
}

function format(n, c, d, t) {
    var c = isNaN(c = Math.abs(c)) ? 2 : c,
        d = d == undefined ? "." : d,
        t = t == undefined ? "," : t,
        s = n < 0 ? "-" : "",
        i = String(parseInt(n = Math.abs(Number(n) || 0).toFixed(c))),
        j = (j = i.length) > 3 ? j % 3 : 0;
     return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
   }

function processPayouts() {
    console.log('--Payouts Started--')
    for (let i = 0; i < payees.length; i++) {

        if (!simulate) {
            steem.broadcast.transfer(config.payout_active_key, config.payout_account, payees[i]['Player'], format(payees[i]['Amount'], 3) + ' ' + config.payout_currency, payees[i]['Memo'], function (err, response) {
                if (err) {
                payment_failures += 1;
                console.log('Error sending payout to @' + payees[i]['Player'] + ' for: ' + payees[i]['Amount'] + ' ' + config.payout_currency + ', Error: ' + err);
                }
                else {
                    console.log('Paid Out: @' + payees[i]['Player'] + ': ' + payees[i]['Amount']);
                    payments += 1;
                    payments_amount += payees[i]['Amount'];
                }
            });
        }
        else {
            console.log('SIMULATED:' + 'Paid Out: @' + payees[i]['Player'] + ': ' + payees[i]['Amount']);
            payments += 1;
            payments_amount += payees[i]['Amount'];
        }
    }
}

startup();
