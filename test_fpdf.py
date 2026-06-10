from fpdf import FPDF
pdf = FPDF()
pdf.add_page()
pdf.set_font('helvetica', '', 10)
data = [['col1', 'col2'], ['long content that should wrap '*5, 'val']]
with pdf.table() as table:
    for data_row in data:
        row = table.row()
        for datum in data_row:
            row.cell(datum)
pdf.output('test_table.pdf')
