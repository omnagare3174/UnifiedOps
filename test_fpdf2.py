from fpdf import FPDF
pdf = FPDF(orientation="landscape")
pdf.add_page()
pdf_headers = ["Local Time", "Severity", "Storage/Switch", "Source IP", "Category", "Event Details"]
with pdf.table(col_widths=(30, 20, 40, 25, 25, 137), text_align="LEFT") as table:
    header_row = table.row()
    pdf.set_font("helvetica", "B", 9)
    for header in pdf_headers:
        header_row.cell(header)
    
    pdf.set_font("helvetica", "", 8)
    for i in range(5):
        data_row = table.row()
        data_row.cell("2026-06-09 18:43:40")
        data_row.cell("Warning")
        data_row.cell("NTT_DC9_X7_127_FAB1")
        data_row.cell("10.226.116.241")
        data_row.cell("Storage")
        data_row.cell("This is a very long event detail string that should automatically word wrap because it is inside the table cell component of fpdf2. It has multiple sentences.")
pdf.output('test_table2.pdf')
