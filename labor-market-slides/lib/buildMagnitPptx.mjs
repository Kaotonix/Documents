import fs from "fs";
import path from "path";
import JSZip from "jszip";

/** @typedef {{ title: string, bullets: string[] }} SlideSpec */

function defaultTemplatePath() {
  return path.join(process.cwd(), "assets", "magnit-template.pptx");
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBodyXml(bullets) {
  const lines = bullets.length ? bullets : ["Add content in PowerPoint."];
  return lines
    .map(
      (t) =>
        `<a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escapeXml(t)}</a:t></a:r></a:p>`
    )
    .join("");
}

const SLIDE_REL = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout18.xml"/></Relationships>`;

function fillSlideXml(seedXml, { title, bullets }, slideIndex) {
  let xml = seedXml;
  xml = xml.replace(
    /<p:cNvPr id="6" name="Title 5"[\s\S]*?<p:txBody>[\s\S]*?<\/p:txBody>/,
    (m) =>
      m.replace(
        /<p:txBody>[\s\S]*?<\/p:txBody>/,
        `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escapeXml(title)}</a:t></a:r></a:p></p:txBody>`
      )
  );
  xml = xml.replace(
    /<p:cNvPr id="7" name="Text Placeholder 6"[\s\S]*?<p:txBody>[\s\S]*?<\/p:txBody>/,
    (m) =>
      m.replace(
        /<p:txBody>[\s\S]*?<\/p:txBody>/,
        `<p:txBody><a:bodyPr/><a:lstStyle/>${buildBodyXml(bullets)}</p:txBody>`
      )
  );
  xml = xml.replace(
    /type="slidenum"[\s\S]*?<a:t>\d+<\/a:t>/,
    (m) => m.replace(/<a:t>\d+<\/a:t>/, `<a:t>${slideIndex}</a:t>`)
  );
  return xml;
}

function rebuildContentTypes(originalXml, slideCount) {
  const stripped = originalXml.replace(
    /<Override PartName="\/ppt\/slides\/slide\d+\.xml" ContentType="application\/vnd\.openxmlformats-officedocument\.presentationml\.slide\+xml"\/>/g,
    ""
  );
  const overrides = Array.from({ length: slideCount }, (_, i) => {
    const n = i + 1;
    return `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }).join("");
  return stripped.replace("</Types>", `${overrides}</Types>`);
}

function buildPresentationXml(n) {
  const head = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/><p:sldMasterId id="2147483660" r:id="rId2"/></p:sldMasterIdLst><p:sldIdLst>`;
  let body = "";
  for (let i = 0; i < n; i++) {
    body += `<p:sldId id="${256 + i}" r:id="rId${3 + i}"/>`;
  }
  const tail = `</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr><a:lvl2pPr marL="457200" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl2pPr><a:lvl3pPr marL="914400" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl3pPr><a:lvl4pPr marL="1371600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl4pPr><a:lvl5pPr marL="1828800" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl5pPr><a:lvl6pPr marL="2286000" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl6pPr><a:lvl7pPr marL="2743200" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl7pPr><a:lvl8pPr marL="3200400" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl8pPr><a:lvl9pPr marL="3657600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl9pPr></p:defaultTextStyle></p:presentation>`;
  return head + body + tail;
}

function buildPresentationRels(n) {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster2.xml"/>
`;
  for (let i = 0; i < n; i++) {
    xml += `<Relationship Id="rId${3 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>\n`;
  }
  const b = 3 + n;
  xml += `<Relationship Id="rId${b}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>
<Relationship Id="rId${b + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>
<Relationship Id="rId${b + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
<Relationship Id="rId${b + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>
</Relationships>`;
  return xml;
}

/**
 * @param {SlideSpec[]} slides
 * @param {{ templatePath?: string, templateBuffer?: Buffer }} [opts]
 * @returns {Promise<Buffer>}
 */
export async function buildMagnitPptx(slides, opts = {}) {
  if (!slides?.length) throw new Error("At least one slide is required.");

  let zipBuf = opts.templateBuffer;
  if (!zipBuf) {
    const p = opts.templatePath ?? defaultTemplatePath();
    if (!fs.existsSync(p)) {
      throw new Error(
        "Missing assets/magnit-template.pptx. Commit that file from npm run pack-template, or copy your packed template into assets/."
      );
    }
    zipBuf = fs.readFileSync(p);
  }

  const zip = await JSZip.loadAsync(zipBuf);
  const seedEntry = zip.file("ppt/slides/slide18.xml");
  if (!seedEntry) {
    throw new Error("Template must contain ppt/slides/slide18.xml (Agenda layout slide).");
  }
  const seed = await seedEntry.async("string");
  const slideKeys = Object.keys(zip.files).filter(
    (k) => /^ppt\/slides\/slide\d+\.xml$/.test(k) && !k.includes("/_rels/")
  );
  const relKeys = Object.keys(zip.files).filter((k) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(k));
  for (const k of slideKeys) zip.remove(k);
  for (const k of relKeys) zip.remove(k);

  const n = slides.length;
  for (let i = 0; i < n; i++) {
    const slideXml = fillSlideXml(seed, slides[i], i + 1);
    zip.file(`ppt/slides/slide${i + 1}.xml`, slideXml);
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, SLIDE_REL);
  }

  const ct = await zip.file("[Content_Types].xml").async("string");
  zip.file("[Content_Types].xml", rebuildContentTypes(ct, n));
  zip.file("ppt/presentation.xml", buildPresentationXml(n));
  zip.file("ppt/_rels/presentation.xml.rels", buildPresentationRels(n));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
