// ============================================================
//  i18n — Thai / English (no JSX)
// ============================================================
export const LANGS = { TH: 'th', EN: 'en' }

export function getLang() {
  try { return localStorage.getItem('lang') || LANGS.TH } catch { return LANGS.TH }
}
export function setLang(lang) {
  try { localStorage.setItem('lang', lang) } catch {}
  window.dispatchEvent(new Event('langchange'))
}

export const T = {
  save:             { th: 'บันทึก',               en: 'Save' },
  cancel:           { th: 'ยกเลิก',                en: 'Cancel' },
  delete:           { th: 'ลบ',                    en: 'Delete' },
  edit:             { th: 'แก้ไข',                 en: 'Edit' },
  add:              { th: 'เพิ่ม',                 en: 'Add' },
  confirm:          { th: 'ยืนยัน',                en: 'Confirm' },
  loading:          { th: 'กำลังโหลด...',          en: 'Loading...' },
  saving:           { th: 'กำลังบันทึก...',        en: 'Saving...' },
  success:          { th: 'บันทึกเรียบร้อย',       en: 'Saved!' },
  error:            { th: 'เกิดข้อผิดพลาด',        en: 'Error' },
  name:             { th: 'ชื่อ',                  en: 'Name' },
  active:           { th: 'ใช้งาน',                en: 'Active' },
  inactive:         { th: 'ปิดใช้งาน',             en: 'Inactive' },
  dragHint:         { th: 'ลากเพื่อเรียงลำดับ',    en: 'Drag to reorder' },
  moveUp:           { th: 'ขึ้น',                  en: 'Up' },
  moveDown:         { th: 'ลง',                    en: 'Down' },
  saveOrder:        { th: 'บันทึกลำดับ',           en: 'Save Order' },
  dashboard:        { th: 'แดชบอร์ด',              en: 'Dashboard' },
  totalIncome:      { th: 'รายรับรวม',              en: 'Total Income' },
  totalExpense:     { th: 'รายจ่ายรวม',             en: 'Total Expense' },
  avgPerPerson:     { th: 'เฉลี่ย/คน',              en: 'Avg/Person' },
  transactions:     { th: 'รายการ',                 en: 'Transactions' },
  directDebt:       { th: 'หนี้โดยตรง',             en: 'Direct Debt' },
  byCategory:       { th: 'รายจ่ายตามหมวด',         en: 'By Category' },
  byPerson:         { th: 'รายจ่ายแต่ละคน',         en: 'By Person' },
  byPayment:        { th: 'ตามวิธีชำระ',             en: 'By Payment' },
  settlement:       { th: 'สรุปการชำระ',             en: 'Settlement' },
  settled:          { th: 'เคลียบิลแล้ว',           en: 'Settled' },
  pending:          { th: 'ยังไม่เคลีย',             en: 'Pending' },
  markSettled:      { th: 'Mark เคลีย',             en: 'Mark Settled' },
  allItems:         { th: 'รายการทั้งหมด',           en: 'All Transactions' },
  noItems:          { th: 'ยังไม่มีรายการ',          en: 'No transactions' },
  average:          { th: 'เฉลี่ย',                 en: 'Average' },
  perPerson:        { th: 'ต่อคน',                  en: 'per person' },
  byCardOwner:      { th: 'สรุปตามเจ้าของบัตร',     en: 'By Card Owner' },
  settledAt:        { th: 'เคลียเมื่อ',              en: 'Settled at' },
  confirmSettle:    { th: 'ยืนยันการเคลียบิล',      en: 'Confirm Settlement' },
  directLabel:      { th: 'โดยตรง',                 en: 'Direct' },
  refresh:          { th: 'รีเฟรช',                 en: 'Refresh' },
  manageCategories: { th: 'จัดการหมวดหมู่',          en: 'Manage Categories' },
  categoryName:     { th: 'ชื่อหมวดหมู่',            en: 'Category Name' },
  icon:             { th: 'ไอคอน',                  en: 'Icon' },
  noCategories:     { th: 'ยังไม่มีหมวดหมู่',        en: 'No categories yet' },
  addCategory:      { th: 'เพิ่มหมวด',              en: 'Add Category' },
  managePayments:   { th: 'จัดการวิธีชำระ',          en: 'Manage Payments' },
  paymentName:      { th: 'ชื่อบัตร/วิธีจ่าย',       en: 'Card / Payment Name' },
  last4:            { th: '4 หลักท้าย',              en: 'Last 4 digits' },
  owner:            { th: 'เจ้าของ',                 en: 'Owner' },
  shared:           { th: 'ร่วมกัน',                 en: 'Shared' },
  type:             { th: 'ประเภท',                  en: 'Type' },
  noPayments:       { th: 'ยังไม่มีวิธีชำระ',         en: 'No payment methods' },
  addPayment:       { th: 'เพิ่มบัตร',               en: 'Add Payment' },
  cash:             { th: 'เงินสด',                  en: 'Cash' },
  credit:           { th: 'บัตรเครดิต',               en: 'Credit Card' },
  debit:            { th: 'บัตรเดบิต',                en: 'Debit Card' },
  promptpay:        { th: 'พร้อมเพย์',                en: 'PromptPay' },
  ewallet:          { th: 'E-Wallet',                en: 'E-Wallet' },
  managePayers:     { th: 'จัดการสมาชิก',             en: 'Manage Members' },
  memberName:       { th: 'ชื่อสมาชิก',               en: 'Member Name' },
  aliases:          { th: 'ชื่อเล่น/ชื่ออื่น',        en: 'Aliases' },
  aliasHint:        { th: 'คั่นด้วยจุลภาค เช่น ออย,oy', en: 'Comma separated e.g. oy,aoy' },
  noMembers:        { th: 'ยังไม่มีสมาชิก',            en: 'No members yet' },
  addMember:        { th: 'เพิ่มสมาชิก',              en: 'Add Member' },
  addExpense:       { th: 'รายจ่ายปกติ',              en: 'Add Expense' },
  addDirectDebt:    { th: 'หนี้',                      en: 'Direct Debt' },
  date:             { th: 'วันที่',                   en: 'Date' },
  itemName:         { th: 'ชื่อรายการ',               en: 'Item Name' },
  amount:           { th: 'จำนวนเงิน (บาท)',          en: 'Amount (THB)' },
  category:         { th: 'หมวดหมู่',                 en: 'Category' },
  payer:            { th: 'ผู้จ่าย',                  en: 'Paid by' },
  paymentMethod:    { th: 'วิธีชำระเงิน',             en: 'Payment Method' },
  note:             { th: 'หมายเหตุ',                 en: 'Note' },
  noteOptional:     { th: 'หมายเหตุ (ไม่บังคับ)',     en: 'Note (optional)' },
  debtor:           { th: 'ลูกหนี้',                  en: 'Debtor' },
  creditor:         { th: 'เจ้าหนี้',                 en: 'Creditor' },
  preview:          { th: 'ตัวอย่าง',                 en: 'Preview' },
  owes:             { th: 'เป็นหนี้',                 en: 'owes' },
  selectPayment:    { th: '-- เลือกวิธีชำระ --',      en: '-- Select Payment --' },
  itemPlaceholder:  { th: 'เช่น ค่าข้าว, Netflix',    en: 'e.g. Lunch, Netflix' },
  notePlaceholder:  { th: 'หมายเหตุเพิ่มเติม',        en: 'Additional notes' },
  detailPlaceholder:{ th: 'เช่น ค่าของที่ซื้อแทน',    en: 'e.g. Item bought on behalf' },
  saveExpense:      { th: 'บันทึกรายจ่าย',            en: 'Save Expense' },
  saveDebt:         { th: 'บันทึกหนี้',               en: 'Save Debt' },
}

export function t(key, lang) {
  const entry = T[key]
  if (!entry) return key
  return entry[lang] || entry.th || key
}
