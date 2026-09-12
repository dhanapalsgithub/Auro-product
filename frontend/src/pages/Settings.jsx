import React, { useEffect, useState } from "react";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, Building2, Percent, Landmark, Bell, Send } from "lucide-react";

const FIELDS = {
  company: [["company_name", "Company Name"], ["gstin", "GSTIN"], ["address", "Address"], ["state", "State"], ["state_code", "State Code"], ["phone", "Phone"], ["email", "Email"], ["tender_ref", "Tender Reference No"]],
  tax: [["hsn_code", "HSN Code"], ["default_rate", "Default Rate per Box (₹)"], ["rate_beer", "Beer Box Rate (₹)"], ["rate_brandy", "Brandy Box Rate (₹)"], ["cgst_percent", "CGST %"], ["sgst_percent", "SGST %"], ["waste_divisor", "Waste Divisor"]],
  bank: [["bank_name", "Bank Name"], ["account_no", "Account No"], ["ifsc", "IFSC Code"], ["upi_id", "UPI ID (for invoice QR)"]],
  reminder: [["reminder_email", "Reminder Email"], ["reminder_whatsapp", "WhatsApp / Mobile (+91…)"]],
};
const NUM = new Set(["default_rate", "rate_beer", "rate_brandy", "cgst_percent", "sgst_percent", "waste_divisor"]);

function Section({ title, icon: Icon, fields, data, onChange }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300"><Icon className="h-4 w-4" /></div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(([k, label]) => (
          <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
            <label className="text-xs text-slate-500">{label}</label>
            <input data-testid={`setting-${k}`} type={NUM.has(k) ? "number" : "text"} step="0.01" value={data[k] ?? ""}
              onChange={(e) => onChange(k, e.target.value)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Settings() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => { api.get("/settings").then((r) => setData(r.data)); }, []);
  const onChange = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...data };
      NUM.forEach((k) => (payload[k] = parseFloat(payload[k]) || 0));
      payload.waste_divisor = parseInt(payload.waste_divisor) || 12;
      const res = await api.put("/settings", payload);
      setData(res.data);
      toast.success("Settings saved");
    } catch (err) { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const testReminder = async () => {
    setTesting(true);
    try {
      const res = await api.post("/reminders/run");
      toast.success(`Reminder sent · ${res.data.due_count} shop(s) due`);
    } catch (err) { toast.error("Reminder run failed"); }
    finally { setTesting(false); }
  };

  if (!data) return null;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company profile, GST rates, bank/UPI & reminders" icon={SettingsIcon}>
        <button data-testid="test-reminder-button" onClick={testReminder} disabled={testing} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition disabled:opacity-60">
          <Send className="h-4 w-4" /> {testing ? "Sending…" : "Send Reminder Now"}
        </button>
        <button data-testid="save-settings-button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Changes"}
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4">
        <Section title="Company Profile" icon={Building2} fields={FIELDS.company} data={data} onChange={onChange} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Tax & Rates" icon={Percent} fields={FIELDS.tax} data={data} onChange={onChange} />
          <Section title="Bank & UPI" icon={Landmark} fields={FIELDS.bank} data={data} onChange={onChange} />
        </div>
        <Section title="Auto Reminders (daily 9 AM IST)" icon={Bell} fields={FIELDS.reminder} data={data} onChange={onChange} />
        <Card className="p-6">
          <label className="text-xs text-slate-500">Invoice Terms & Conditions</label>
          <textarea data-testid="setting-terms" value={data.terms || ""} onChange={(e) => onChange("terms", e.target.value)} rows={3}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
          <p className="text-xs text-slate-500 mt-3">WhatsApp/SMS reminders require Twilio credentials in the backend .env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM). Email reminders work out of the box.</p>
        </Card>
      </div>
    </div>
  );
}
