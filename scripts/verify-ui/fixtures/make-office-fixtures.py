#!/usr/bin/env python3
"""Regenerate the Batch 5 Office fixtures.

The three documents are minimal-but-valid OOXML packages — just enough parts for
LibreOffice to open them as a real document, so `batch5.mjs` can prove that the
Word/PowerPoint/Excel routes convert actual content rather than an empty shell:

  office.docx  one page of text ("Batch 5 Word fixture")
  office.pptx  a single slide with a text box ("Batch 5 slide fixture")
  office.xlsx  120 data rows, which the default export spreads over 3 pages, so
               `fitToPage` can be shown to collapse them to 1

`office-mislabelled.docx` is deliberately *not* a document package: it is plain
text with a .docx name. LibreOffice would happily convert it into a PDF of that
text and exit 0, which is exactly the silent mis-conversion the endpoint's
container sniff exists to prevent — the suite asserts the 422.

Usage:  python3 scripts/verify-ui/fixtures/make-office-fixtures.py
"""

import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))

PACKAGE_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
    'relationships/{kind}" Target="{target}"/>'
    "</Relationships>"
)

CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    "{overrides}</Types>"
)


def package_rels(target: str, kind: str) -> str:
    return PACKAGE_RELS.format(target=target, kind=kind)


def write_docx() -> None:
    with zipfile.ZipFile(os.path.join(HERE, "office.docx"), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "[Content_Types].xml",
            CONTENT_TYPES.format(
                overrides='<Override PartName="/word/document.xml" ContentType="application/vnd.'
                'openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            ),
        )
        z.writestr("_rels/.rels", package_rels("word/document.xml", "officeDocument"))
        z.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body>"
            "<w:p><w:r><w:t>Batch 5 Word fixture</w:t></w:r></w:p>"
            "<w:p><w:r><w:t>Second line for the page.</w:t></w:r></w:p>"
            "</w:body></w:document>",
        )


def write_pptx() -> None:
    with zipfile.ZipFile(os.path.join(HERE, "office.pptx"), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "[Content_Types].xml",
            CONTENT_TYPES.format(
                overrides='<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.'
                'openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
                '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.'
                'openxmlformats-officedocument.presentationml.slide+xml"/>'
                '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.'
                'openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
                '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.'
                'openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
            ),
        )
        z.writestr("_rels/.rels", package_rels("ppt/presentation.xml", "officeDocument"))
        z.writestr(
            "ppt/presentation.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst>'
            '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>'
            '<p:sldSz cx="9144000" cy="6858000"/></p:presentation>',
        )
        z.writestr(
            "ppt/_rels/presentation.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
            'relationships/slide" Target="slides/slide1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
            'relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'
            "</Relationships>",
        )
        z.writestr(
            "ppt/slideMasters/slideMaster1.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
            "</p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>"
            '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
            "</p:sldMaster>",
        )
        z.writestr(
            "ppt/slideMasters/_rels/slideMaster1.xml.rels",
            package_rels("slideLayouts/slideLayout1.xml", "slideLayout"),
        )
        z.writestr(
            "ppt/slideLayouts/slideLayout1.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">'
            '<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/>'
            "<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>"
            "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>",
        )
        z.writestr(
            "ppt/slides/_rels/slide1.xml.rels",
            package_rels("../slideLayouts/slideLayout1.xml", "slideLayout"),
        )
        z.writestr(
            "ppt/slides/slide1.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            "<p:cSld><p:spTree>"
            '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
            "<p:grpSpPr/>"
            '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr txBox="1"/><p:nvPr/>'
            "</p:nvSpPr>"
            '<p:spPr><a:xfrm><a:off x="838200" y="365125"/><a:ext cx="6400800" cy="1200000"/>'
            '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
            "<p:txBody><a:bodyPr/><a:lstStyle/>"
            '<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Batch 5 slide fixture</a:t></a:r></a:p>'
            "</p:txBody></p:sp>"
            "</p:spTree></p:cSld></p:sld>",
        )


def write_xlsx() -> None:
    rows = "".join(
        f'<row r="{i + 1}">'
        f'<c r="A{i + 1}" t="inlineStr"><is><t>Row {i + 1} label</t></is></c>'
        f'<c r="B{i + 1}" t="inlineStr"><is><t>{i * 7}</t></is></c>'
        "</row>"
        for i in range(120)
    )
    with zipfile.ZipFile(os.path.join(HERE, "office.xlsx"), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "[Content_Types].xml",
            CONTENT_TYPES.format(
                overrides='<Override PartName="/xl/workbook.xml" ContentType="application/vnd.'
                'openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.'
                'openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            ),
        )
        z.writestr("_rels/.rels", package_rels("xl/workbook.xml", "officeDocument"))
        z.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        z.writestr("xl/_rels/workbook.xml.rels", package_rels("worksheets/sheet1.xml", "worksheet"))
        z.writestr(
            "xl/worksheets/sheet1.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f"<sheetData>{rows}</sheetData></worksheet>",
        )


def write_mislabelled() -> None:
    with open(os.path.join(HERE, "office-mislabelled.docx"), "w", encoding="utf-8") as handle:
        handle.write("This is not a Word package at all.\n")


if __name__ == "__main__":
    write_docx()
    write_pptx()
    write_xlsx()
    write_mislabelled()
    print("office fixtures written to", HERE)
