/**
 * Logical-name → human Turkish label mapping for Dataverse columns.
 *
 * Source: D365 F&O form metadata extracted from the "Record info" export
 * (the screen the user actually sees in F&O). Mapped here so the Veri
 * Yönetimi inspector reads like the production app instead of like a raw
 * database schema. Falls back to the raw `mserp_*` system name when a
 * field isn't in the map — useful when new fields surface during smoke
 * tests, the cell tooltip still shows the system name.
 *
 * Keys are stored in lowercase Dataverse logical-name form (`mserp_<f>`).
 * Add new entities here as their D365 record-info exports come in.
 */

export const FIELD_LABELS: Record<string, string> = {
  /* ─────────── mserp_tryaiprojectshiprelationentities (Gemi Planı) ─────────── */
  mserp_arrivaldate: "DP-ETA Tahmini Varış Tarihi",
  mserp_assignmentid: "Fixture ID",
  mserp_bookingdate: "Booking date",
  mserp_buyerrec: "Buyer",
  mserp_cargogood: "Taşınan Ürünler",
  mserp_cargoquantity: "Gemi Seferi Toplam Tonaj",
  mserp_charterepartyname: "Gemiyi Kiralayan",
  mserp_charterer: "Counter party",
  mserp_chartererpartys: "Counter party",
  mserp_companyid: "Şirket Hesap Kodu",
  mserp_createdby: "Oluşturan",
  mserp_createddatetime: "Oluşturulma tarihi ve saati",
  mserp_departuredate: "ETD (L/P) Tahmini Kalkış Tarihi",
  mserp_dischargecountryregionid: "Varış Ülke/Bölge",
  mserp_dischargeporting: "Varış Limanı",
  mserp_dlvmodeid: "Teslimat Şekli",
  mserp_dlvtermid: "Teslimat Koşulları",
  mserp_evacuationtime: "Tahliye Süresi (Gün)",
  mserp_laycanfrom: "Cargo laycan from",
  mserp_loadingcountryregionid: "Kalkış Ülke/Bölge",
  mserp_loadingport: "Kalkış Limanı",
  mserp_loadingtime: "Yükleme Süresi (Gün)",
  mserp_modifiedby: "Değiştiren",
  mserp_modifieddatetime: "Değiştirilme tarihi ve saati",
  mserp_netfreightamount: "Ürün Bedeli ($)",
  mserp_outturnquantity: "Gerçekleşen Miktar (MT)",
  mserp_partition: "Bölüm",
  mserp_paymentsched: "Ödeme Planı",
  mserp_paymtermid: "Ödeme Yöntemi",
  mserp_purchqty: "Gerçekleşen Miktar",
  mserp_recid: "Kayıt Kodu",
  mserp_recversion: "Kayıt Sürümü",
  mserp_refrecid: "Proje Satırları",
  mserp_reftableid: "Referans Tablosu Kodu",
  mserp_sellerrec: "Seller",
  mserp_shipoperator: "Operasyon Sorumlusu",
  mserp_sysrowversion: "SYSROWVERSION",
  mserp_tradedesk: "Trade Desk",
  mserp_transfertime: "Transit Süresi (Gün)",
  mserp_transittime: "Transit Süresi (ETA, Gün)",
  mserp_tryarrivalconfirmdate: "DP-NOR-Accepted",
  mserp_tryassignmentid: "TRY Assignment ID",
  mserp_trybuyer: "Müşteri/Satıcı Firma",
  mserp_trycargogoods: "Taşınan Ürünler",
  mserp_trydemurragereason: "Yükleme Limanındaki Demoraj Sebebi",
  mserp_trydemurragereasondesc: "Yükleme Limanındaki Demoraj Açıklaması",
  mserp_trydemurragereasonexp: "Yükleme Limanındaki Demoraj Sebebi",
  mserp_trydeparturedatebl: "BL Düzenleme Tarihi",
  mserp_trydescription: "Açıklama",
  mserp_trydischargedemurragedesc: "Tahliye Limanındaki Demoraj Açıklaması",
  mserp_trydischargedemurragereason: "Tahliye Limanındaki Demoraj Sebebi",
  mserp_trydischargedemurragereasonexp: "Tahliye Limanındaki Demoraj Sebebi",
  mserp_trydischargeenddate: "DP-(ED) Tahliye Bitiş Tarihi",
  mserp_trydischargeport: "Varış Limanı",
  mserp_trydischargestartdate: "DP-(SD) Tahliye Başlangıç Tarihi",
  mserp_tryestimatedtimeofarrival: "LP-(ETA) Tahmini Varış Tarihi",
  mserp_tryestimatedtimeofdeparture: "ETD (D/P) Tahmini Kalkış Tarihi",
  mserp_tryexpenseprojecttype: "İşlem Yönü",
  mserp_trylinenum: "Satır Numarası",
  // Alt-proje (mserp_trysubprojectentities) alanları
  mserp_subprojectid: "Alt Proje No",
  mserp_subprojectdetailsid: "Alt Proje Satırı No",
  mserp_segmentid: "Segment",
  mserp_subsegmentid: "Alt Segment",
  mserp_inventsiteid: "Lokasyon",
  mserp_etgcustchainbranchcode: "Müşteri Zincir / Şube",
  mserp_etgtmsrouteid: "TMS Rota",
  mserp_portreceipt: "Teslim Alma Limanı",
  mserp_portissue: "Çıkış Limanı",
  mserp_tryloadenddate: "LP-(ED) Yükleme Bitiş Tarihi",
  mserp_tryloadingport: "Kalkış Limanı",
  mserp_tryloadstartdate: "LP-(SD) Yükleme Başlangıç Tarihi",
  mserp_trynoraccepteddate: "LP-NOR-Accepted",
  mserp_trypaymentstatus: "Ödeme Durumu",
  mserp_tryprojectsegment: "Segment",
  mserp_tryseller: "Tedarikçi Firma",
  mserp_tryshipmentstatus: "Operasyon Durumu",
  mserp_tryshipprojid: "Proje No",
  mserp_vessel: "Gemi",
  mserp_vesselname: "Gemi Adı",
  mserp_vesselvoyagenumber: "Sefer",
  mserp_imonumber: "IMO Numarası",
  mserp_vesseltable_recid: "Gemi RecID",
  mserp_voyageouttype: "Charter Out Type",
  mserp_voyagestatus: "Gemi Durumu",

  /* ─────────── mserp_etgtryprojecttableentities (Projeler) ─────────── */
  mserp_projid: "Proje No",
  mserp_projname: "Proje Adı",
  mserp_projgroupid: "Proje Grubu",
  mserp_contractdate: "Sözleşme Tarihi",
  mserp_executionperiod: "Operasyon Periyodu",
  mserp_status: "Durum",
  mserp_workflowstatus: "İş Akışı Durumu",
  mserp_traderid: "Trader",
  mserp_maintraderid: "Ana Trader",
  mserp_currencycode: "Para Birimi",
  mserp_dlvmode: "Teslimat Şekli",
  mserp_dlvterm: "Teslimat Koşulu",
  mserp_projtradetypeid: "Ticaret Tipi",
  mserp_vendaccount: "Satıcı Hesabı",
  mserp_vendaccountdescription: "Satıcı Açıklaması",

  /* ─────────── mserp_tryaiprojectlineentities (Proje Satırları) ─────────── */
  mserp_linenum: "Satır No",
  mserp_itemid: "Madde Kodu",
  mserp_qty: "Miktar",
  mserp_unitid: "Birim",
  // System names are swapped in F&O (`unitprice` is the SALES price,
  // `salesprice` is the PURCHASE/buying price). The labels here flip
  // them back to the operationally correct semantics shown in the UI.
  mserp_unitprice: "Satış Birim Fiyatı",
  mserp_salesprice: "Alım Birim Fiyatı",
  mserp_priceunit: "Fiyat Birimi",
  mserp_etgproductlevel01: "Ürün Seviye 1",
  mserp_etgproductlevel02: "Ürün Seviye 2",
  mserp_etgproductlevel03: "Ürün Seviye 3",
  mserp_qualitycategoryid: "Kalite Kategorisi",
  mserp_overdelivery: "Aşırı Teslimat",
  mserp_startdate: "Başlangıç Tarihi",
  mserp_enddate: "Bitiş Tarihi",

  /* ─────────── mserp_tryaiotherexpenseentities (Tahmini Gider) ───────────
   * Switched April 2026 from the legacy ProjectLine variant. Project FK is
   * `mserp_etgtryprojid` (NOT `mserp_tryplanprojectid`). F&O labels:
   *   mserp_etgtryprojid     → "Proje No"
   *   mserp_tryexpensetype   → "Yan masraf türü" (numeric code; FormattedValue
   *                             carries friendly category like "Operasyonel giderler")
   *   mserp_expamountusdd    → "Tahmini Birim Fiyat USD"
   * Legacy fields (kept so cached rows from old entity still render readably):
   *   mserp_refexpenseid     → "Referans masraf no"
   *   mserp_tryplanprojectid → "Proje No"
   *   mserp_totalexpectedamount → "Tahmini Toplam Tutar USD"
   */
  mserp_tryplanprojectid: "Proje No",
  mserp_refexpenseid: "Referans masraf no",
  mserp_tryexpensetype: "Yan masraf türü",
  mserp_expamountusdd: "Tahmini Birim Fiyat USD",
  mserp_totalexpectedamount: "Tahmini Toplam Tutar USD",
  mserp_description: "Açıklama",

  /* ─────────── mserp_tryaisaleslineentities (Satış Satırları — duplicates) ─────────── */
  mserp_etgtryprojid: "Proje No",
  mserp_etgtraderid: "Trader",
  mserp_etgmaintraderid: "Ana Trader",
  mserp_salesid: "Satış No",
  mserp_custaccount: "Müşteri Hesabı",
  mserp_custname: "Müşteri Adı",
  mserp_salesname: "Müşteri Ünvanı",
  mserp_name: "Ürün Adı",
  mserp_salesqty: "Satış Miktarı",
  mserp_lineamount: "Satır Tutarı",
  mserp_etglastdeliverydate: "Son Teslim Tarihi",
  mserp_salesstatus: "Satış Durumu",
  mserp_linestatus: "Satır Durumu",
  mserp_invoiceid: "Fatura No",
  mserp_invoicedate: "Fatura Tarihi",
  mserp_dlvdate: "Teslim Tarihi",

  /* ─────────── mserp_tryaiprojectbudgetlineentities (Bütçe) ─────────── */
  mserp_segment: "Segment",
  mserp_year: "Dönem",
  mserp_projectexpenseid: "Bütçe Tipi",
  mserp_amount: "Tutar",

  /* ─────────── mserp_tryaiexpenselineentities (Gerçekleşen Gider) ───────────
   * The two-step chain (frt-dist filter → expense-line authoritative)
   * surfaces these 4 columns in the Veri Yönetimi tab.
   */
  mserp_expensenum: "Masraf No",
  mserp_expenseid: "Masraf Kalemi",
  mserp_amountcur: "Tutar",
  // mserp_description already mapped above (line ~143) → "Açıklama".

  /* ─────────── mserp_tryaivendinvoicetransentities (Gerçekleşen Satınalma) ───
   * Vendor invoice transactions joined to the parent purchase table
   * via flattened `mserp_purchtable_*` columns. Most fields here are
   * already labelled in the project / sales sections above (they
   * share names — itemid, name, qty, invoicedate, lineamount,
   * currencycode); the entries below cover the purchase-only fields.
   */
  mserp_purchtable_etgtryprojid: "Proje No",
  mserp_purchid: "Satınalma No",
  mserp_purchtable_etgtraderid: "Trader",
  mserp_purchtable_etgmaintraderid: "Ana Trader",
  mserp_purchtable_purchname: "Satınalma Açıklaması",
  mserp_purchprice: "Birim Alış Fiyatı",
};

/**
 * Get the human-readable label for a Dataverse field. Falls back to the
 * system name (lowercased) when the field isn't in the map.
 */
export function getFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName;
}
