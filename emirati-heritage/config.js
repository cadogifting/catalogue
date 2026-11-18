/* CADO catalogue settings (version 3). Everything that may change on publication lives here. */
window.CADO_CONFIG = {
  // Requests are addressed here, and only here.
  email: "info@cadogifting.com",

  // Google Apps Script web app URL that writes to the "CADO Requests" sheet on CADO's Workspace.
  // Leave empty until Yana authorises it. While empty, "Send request" opens an email to the
  // address above, and "Copy request" is the fallback. Once set, requests are posted here first.
  requestEndpoint: "",

  // Generated data and photographs (written by tools/build_data.py).
  data: "data/",

  // The collection as a PDF (generated from print.html). Leave empty to hide the link.
  pdf: "data/pdf/2026-11-18_cado-emirati-heritage-collection_v2.pdf",

  // The cover at the top of a collection: "dark" (coal) or "light" (creme with coal type).
  cover: "light",

  // Shows the "Design preview" tag. Set to false only when Yana approves publication.
  preview: false
};
