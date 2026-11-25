<template>
  <section class="max-w-7xl">
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">OKG Manager · Staff operations</p>
      <h1 class="mt-2 text-3xl font-bold text-white">Moderation</h1>
      <p class="mt-2 max-w-3xl text-sm text-gray-400">Create cases and review moderation records. The dedicated OKG Moderation bot calculates points, progression, expirations, and Discord enforcement.</p>
    </header>
    <div class="mb-5 flex flex-wrap gap-2 border-b border-gray-800 pb-3">
      <button v-for="tab in tabs" :key="tab.id" @click="activeTab=tab.id" class="rounded-lg px-4 py-2 text-sm font-semibold" :class="activeTab===tab.id?'bg-indigo-600 text-white':'bg-gray-900 text-gray-300 hover:bg-gray-800'">{{tab.label}}</button>
      <span class="ml-auto self-center text-xs text-gray-500">Access: {{role}}</span>
    </div>
    <section v-if="activeTab==='cases'" class="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-semibold text-white">Moderation cases</h2><p class="text-sm text-gray-400">Newest cases first · {{cases.length}} loaded</p></div><button @click="loadCases" class="rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800">Refresh</button></div>
      <div v-if="loading" class="py-8 text-gray-400">Loading cases…</div>
      <div v-else-if="!cases.length" class="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500">No moderation cases have been created yet.</div>
      <div v-else class="space-y-3">
        <article v-for="item in cases" :key="item.id" class="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold text-white">Case #{{item.caseNumber}} · {{item.category}}</h3><p class="text-xs text-gray-500">{{item.subject?.username}} · {{item.subject?.discordId}} · {{date(item.createdAt)}}</p></div><span class="rounded-full bg-slate-800 px-3 py-1 text-xs text-blue-200">{{item.status.replaceAll('_',' ')}}</span></div>
          <p class="mt-3 text-sm text-gray-300">{{item.reason}}</p>
          <div class="mt-3 grid gap-2 text-xs text-gray-500 sm:grid-cols-4"><span>Offence: {{item.offenceCode}}</span><span>Severity: {{item.severity??'Default'}}</span><span>Points: {{item.pointsAwarded}}</span><span>Expires: {{item.expiresAt?date(item.expiresAt):'Not set'}}</span></div>
          <div class="mt-3 flex flex-wrap gap-2"><button @click="editCase(item)" class="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-200 hover:bg-gray-800">Edit case</button><button @click="showDetails(item)" class="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-200 hover:bg-gray-800">Details & evidence</button></div>
          <pre v-if="expanded===item.id" class="mt-3 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-gray-400">{{JSON.stringify({internalNotes:item.internalNotes,evidenceUrls:item.evidenceUrls,executionResult:item.executionResult},null,2)}}</pre>
        </article>
      </div>
    </section>
    <section v-else class="max-w-3xl rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <h2 class="text-xl font-semibold text-white">Create moderation case</h2>
      <p class="mt-1 text-sm text-gray-400">Severity can be left on the configured default or overridden. The reason is required and becomes part of the permanent case record.</p>
      <form class="mt-5 space-y-4" @submit.prevent="createCase">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm text-gray-300">Member Discord ID<input v-model.trim="form.subjectDiscordId" required class="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white" placeholder="Discord user ID"></label>
          <label class="block text-sm text-gray-300">Offence category<input v-model.trim="form.category" required class="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white" placeholder="e.g. Conduct"></label>
          <label class="block text-sm text-gray-300">Specific offence code<input v-model.trim="form.offenceCode" required class="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white" placeholder="e.g. SPAM"></label>
          <label class="block text-sm text-gray-300">Severity override<select v-model="form.severity" class="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"><option value="">Use configured default</option><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option><option value="4">Level 4</option><option value="5">Level 5</option></select></label>
        </div>
        <label class="block text-sm text-gray-300">Reason<textarea v-model.trim="form.reason" required minlength="5" rows="4" class="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white" placeholder="Explain what happened and why this case is being issued."></textarea></label>
        <label class="block text-sm text-gray-300">Evidence URLs<textarea v-model="form.evidence" rows="3" class="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white" placeholder="One URL per line"></textarea></label>
        <label class="block text-sm text-gray-300">Internal staff notes<textarea v-model="form.internalNotes" rows="3" class="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"></textarea></label>
        <p v-if="message" class="rounded-lg bg-slate-800 p-3 text-sm" :class="error?'text-red-200':'text-emerald-200'">{{message}}</p>
        <button :disabled="saving" class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{{saving?'Submitting…':'Submit case'}}</button>
      </form>
    </section>
  </section>
</template>
<script lang="ts">
import { get, post, patch } from "../../api";
export default {
  data() { return { role:"", tabs:[{id:"cases",label:"Cases"},{id:"create",label:"Create case"}], activeTab:"cases", cases:[] as any[], loading:true, saving:false, message:"", error:false, expanded:"", form:{subjectDiscordId:"",category:"",offenceCode:"",severity:"",reason:"",evidence:"",internalNotes:""} }; },
  async mounted() { await this.load(); },
  methods: {
    date(value:string) { return new Date(value).toLocaleString(); },
    async load() { this.loading=true; try { const access:any=await get("moderation/access"); if(!access?.allowed) throw new Error("Your Discord account does not currently have moderation access."); this.role=access.role; await this.loadCases(); } catch(e:any) { this.error=true; this.message=e?.body?.error||e?.message||"Could not connect to OKG Moderation."; } finally { this.loading=false; } },
    async loadCases() { this.cases=await get("moderation/cases")||[]; },
    showDetails(item:any) { this.expanded=this.expanded===item.id?"":item.id; },
    async createCase() { this.saving=true;this.message="";this.error=false;try { const payload={requestId:crypto.randomUUID(),subjectDiscordId:this.form.subjectDiscordId,category:this.form.category,offenceCode:this.form.offenceCode,severity:this.form.severity===""?null:Number(this.form.severity),reason:this.form.reason,evidenceUrls:this.form.evidence.split("\n").map(x=>x.trim()).filter(Boolean),internalNotes:this.form.internalNotes};const result:any=await post("moderation/cases",payload);this.message=`Case #${result.case.caseNumber} submitted to the moderation bot.`;this.form={subjectDiscordId:"",category:"",offenceCode:"",severity:"",reason:"",evidence:"",internalNotes:""};this.activeTab="cases";await this.loadCases();}catch(e:any){this.error=true;this.message=e?.body?.error||e?.message||"Could not submit case.";}finally{this.saving=false;} },
    async editCase(item:any) { const reason=prompt("Update the case reason:",item.reason);if(reason===null)return;const editReason=prompt("Why is this edit necessary?");if(!editReason)return;const changes:any={reason};if(this.role==="ADMINISTRATOR"){const sev=prompt("New severity (1–5), or blank for configured default:",item.severity??"");if(sev===null)return;changes.severity=sev.trim()===""?null:Number(sev);if(changes.severity!==null&&(!Number.isInteger(changes.severity)||changes.severity<1||changes.severity>5)){alert("Severity must be 1–5 or blank.");return;}}try{const result:any=await patch("moderation/cases/"+item.id,{changes,editReason});alert(result.approvalRequired?"Edit sent to Administrators for approval.":"Case updated and bot reconciliation queued.");await this.loadCases();}catch(e:any){alert(e?.body?.error||e?.message||"Could not edit case.");} },
  },
};
</script>