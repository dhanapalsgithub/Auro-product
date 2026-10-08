# Here are your Instructions

cd frontend
npm start

cd backend
python server.py

https://distant-curtain-sixtieth.ngrok-free.dev/scan-qr




if customer ask delete invoice all or particular invoice

### delete all invoice from invoice record table - goto neon consloe

TRUNCATE TABLE invoices RESTART IDENTITY CASCADE;


DELETE FROM invoice;


## Delete Specific Invoices Only

DELETE FROM invoices 
WHERE invoice_id IN (
    SELECT id FROM invoices WHERE invoice_no = 'INV-20261008-8958'
);

-- Step 2: Delete the main invoice
DELETE FROM sale_invoices 
WHERE invoice_no = 'INV-20261008-8958';