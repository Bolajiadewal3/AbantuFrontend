const contactItems = [
  { label: "Emergency number", value: "[Add local emergency number and when to call it]" },
  { label: "Duty manager / on-call lead", value: "[Add name, phone number, and out-of-hours route]" },
  { label: "Safeguarding lead", value: "[Add name and contact route]" },
  { label: "Approved incident reporting route", value: "[Add form, system, or paper-process location]" },
];

export default function CarerIncidentGuide() {
  return (
    <article className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-lg font-bold text-white shadow-md">
          C
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">CareApp · Carer information</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">What to do if an incident happens</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep this page available while you are on shift.</p>
        </div>
      </header>

      <aside className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 sm:p-5">
        <h2 className="text-base font-bold">Immediate danger or urgent medical need</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Protect immediate safety and follow your training and the person’s care plan. Call the local emergency number when needed. Do not delay urgent help to complete CareApp or paperwork. Notify the duty manager as soon as it is safe.
        </p>
        <p className="mt-3 rounded-lg border border-amber-700/40 bg-white/60 p-3 text-sm font-semibold dark:bg-black/20">
          Local emergency number and escalation instructions: <span className="font-normal">[Company to complete]</span>
        </p>
      </aside>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Make the situation safe</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Follow the person’s current care plan, your training, and the service’s emergency procedures. Get appropriate help. Do not investigate, speculate, or do anything outside your role.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Contact the right people</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Contact the duty manager promptly. The manager or safeguarding lead will advise on clinical escalation, family or representative contact, and any required external reporting.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Record the facts</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          When immediate needs are addressed, use the approved incident reporting route. Record when and where it happened, what you observed or were told, actions taken, who you contacted and when, and any follow-up requested. Separate facts from opinions and protect the person’s privacy.
        </p>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Service contacts and reporting route</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">These details must be completed and approved by the care provider.</p>
        </div>
        <dl className="divide-y divide-slate-200 dark:divide-slate-800">
          {contactItems.map((item) => (
            <div key={item.label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[minmax(12rem,0.8fr)_2fr] sm:gap-4">
              <dt className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</dt>
              <dd className="text-sm text-slate-600 dark:text-slate-400">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        This quick guide is not a substitute for your provider’s approved safeguarding policy, care plan, or local reporting requirements. Use the approved downtime process if CareApp is unavailable.
      </p>
    </article>
  );
}