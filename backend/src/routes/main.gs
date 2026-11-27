/**
 * HTTP entry points. Every request is a JSON POST with an "action"; this file maps actions to controllers.
 */

function doGet() {
  return json_({ ok: true, service: 'soft-cookies-ordering', flavours: FLAVOURS.length });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    FLAVOURS = products_();                 // live product list (admin can add / archive products)
    var handlers = {
      create: create_, get: get_, update: update_, cancel: cancel_, myOrders: myOrders_,
      agentGet: agentGet_, agentSaveProfile: agentSaveProfile_, agentSaveSales: agentSaveSales_,
      getAnnouncement: getAnnouncement_, adminSetAnnouncement: adminSetAnnouncement_,
      spAgents: spAgents_, spAddAgent: spAddAgent_, spUpdateAgent: spUpdateAgent_,
      spDistribute: spDistribute_, spUpdateDist: spUpdateDist_, spDeleteDist: spDeleteDist_,
      spAddPayment: spAddPayment_, spDeletePayment: spDeletePayment_,
      agLogin: agLogin_, agReceive: agReceive_, agSaveSales: agSaveSales_, agSaveProfile: agSaveProfile_,
      adminTree: adminTree_, spLogin: spLogin_, spSetProfile: spSetProfile_, adminSalespersons: adminSalespersons_,
      spSetPin: spSetPin_, adminSaveSalesperson: adminSaveSalesperson_, adminResetPin: adminResetPin_,
      publicSettings: publicSettings_, adminGetSettings: adminGetSettings_, adminSetSettings: adminSetSettings_,
      adminAddHQPayment: adminAddHQPayment_, adminDeleteHQPayment: adminDeleteHQPayment_, adminLog: adminLog_,
      adminListAnnouncements: adminListAnnouncements_, adminAddAnnouncement: adminAddAnnouncement_, adminDeleteAnnouncement: adminDeleteAnnouncement_,
      adminList: adminList_, adminSetStatus: adminSetStatus_, adminDelete: adminDelete_,
      // HQ modules: products, finance, raw materials, suppliers, approvals, targets, security
      adminHQ: adminHQ_, adminSaveProduct: adminSaveProduct_, adminSaveExpense: adminSaveExpense_, adminVoidExpense: adminVoidExpense_,
      adminSaveMaterial: adminSaveMaterial_, adminStockMove: adminStockMove_, adminSaveSupplier: adminSaveSupplier_,
      adminAddPurchase: adminAddPurchase_, adminVoidPurchase: adminVoidPurchase_, adminPayPurchase: adminPayPurchase_,
      adminDecide: adminDecide_, adminChangePassword: adminChangePassword_, adminEndSession: adminEndSession_, adminBackup: adminBackup_,
      agRequest: agRequest_, agCancelRequest: agCancelRequest_, spDecideAgentReq: spDecideAgentReq_,
      spRequests: spRequests_, spAddRequest: spAddRequest_, spCancelRequest: spCancelRequest_, spLogoutAll: spLogoutAll_,
      spInvoices: spInvoices_, spSaveInvoice: spSaveInvoice_, spSetInvoiceStatus: spSetInvoiceStatus_
    };
    var fn = handlers[req.action];
    if (!fn) throw new Error('Tindakan tidak dikenali.');
    // Salesperson actions are authorised by the salesperson code (e.g. salesAkmal), never by a bare phone number.
    if (SP_ACTIONS[req.action]) req.phone = spPhoneOf_(req.sp, req.tok);
    return json_(fn(req));
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

var SP_ACTIONS = { create: 1, get: 1, update: 1, cancel: 1, myOrders: 1, agentGet: 1, agentSaveProfile: 1, agentSaveSales: 1, spAgents: 1, spAddAgent: 1, spUpdateAgent: 1,
                   spDistribute: 1, spUpdateDist: 1, spDeleteDist: 1, spAddPayment: 1, spDeletePayment: 1,
                   spRequests: 1, spAddRequest: 1, spCancelRequest: 1, spLogoutAll: 1, spDecideAgentReq: 1,
                   spInvoices: 1, spSaveInvoice: 1, spSetInvoiceStatus: 1 };
