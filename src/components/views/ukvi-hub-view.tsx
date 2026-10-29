'use client';

import React, { useMemo, useState } from 'react';
import {
  Calculator,
  CalendarClock,
  CheckSquare,
  GraduationCap,
  MessageCircleQuestion,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/hooks/use-api';
import { StudyRoadmapPanel } from '@/components/studio/study-roadmap-panel';

const UNIVERSITY_CATALOG = [
  { name: 'University of Manchester', country: 'UK', city: 'Outside London', minGpa: 3.3, minIelts: 6.5, tuitionGbp: 24500, scholarshipMaxGbp: 5000, intakes: 'Sep' },
  { name: 'Coventry University', country: 'UK', city: 'Outside London', minGpa: 2.6, minIelts: 6.0, tuitionGbp: 16800, scholarshipMaxGbp: 3000, intakes: 'Jan / May / Sep' },
  { name: 'University of Greenwich', country: 'UK', city: 'London', minGpa: 2.7, minIelts: 6.0, tuitionGbp: 17200, scholarshipMaxGbp: 3000, intakes: 'Jan / Sep' },
  { name: 'University of Portsmouth', country: 'UK', city: 'Outside London', minGpa: 2.6, minIelts: 6.0, tuitionGbp: 16200, scholarshipMaxGbp: 2500, intakes: 'Jan / Sep' },
  { name: 'Middlesex University London', country: 'UK', city: 'London', minGpa: 2.5, minIelts: 6.0, tuitionGbp: 15900, scholarshipMaxGbp: 2000, intakes: 'Jan / Sep' },
  { name: 'University of Hertfordshire', country: 'UK', city: 'Outside London', minGpa: 2.5, minIelts: 6.0, tuitionGbp: 15500, scholarshipMaxGbp: 2000, intakes: 'Jan / May / Sep' },
  { name: 'Macquarie University', country: 'Australia', city: 'Sydney', minGpa: 3.0, minIelts: 6.5, tuitionGbp: 21000, scholarshipMaxGbp: 5000, intakes: 'Feb / Jul' },
  { name: 'University of Waterloo', country: 'Canada', city: 'Ontario', minGpa: 3.5, minIelts: 6.5, tuitionGbp: 23500, scholarshipMaxGbp: 4000, intakes: 'Sep / Jan' },
];

const UKVI_DOC_CHECKLIST = [
  'Valid Passport (covering full course duration)',
  'Unconditional Offer Letter & Official CAS Statement',
  '28-Day Consecutive Bank Statement (closing date within 31 days of visa submission)',
  'Academic Transcripts & Degree Certificates (attested)',
  'Approved UKVI IELTS / PTE Academic / University Waiver Verification',
  'TB Screening Certificate from UKVI-approved clinic',
  'ATAS Certificate (if applicable for sensitive STEM postgraduate subjects)',
  'Statement of Purpose (SOP) aligned with career progression in home country',
];

const CREDIBILITY_QUESTIONS = [
  {
    q: 'Why did you choose the UK over studying in your home country or other destinations?',
    tip: 'Compare 1-year UK Masters duration, specific module curriculum, and QAA teaching standards against concrete alternatives.',
  },
  {
    q: 'Why this specific university and course rather than two other UK universities you researched?',
    tip: 'Name at least 2 shortlisted rival universities, compare exact module titles, accreditation, tuition ROI, and campus facilities.',
  },
  {
    q: 'How is your tuition and 9-month living maintenance funded, and how does this investment fit your post-study career plan?',
    tip: 'State exact GBP figures matching your CAS & 28-day bank statement, sponsor relationship, and target roles/salaries post-graduation.',
  },
];

export default function UkviHubView() {
  // Student Matcher state
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [gpa, setGpa] = useState('3.1');
  const [ielts, setIelts] = useState('6.5');
  const [maxTuition, setMaxTuition] = useState('20000');

  // UKVI CAS Calculator state
  const [studyZone, setStudyZone] = useState<'london' | 'outside'>('london');
  const [tuitionYear1, setTuitionYear1] = useState('16800');
  const [depositPaid, setDepositPaid] = useState('3000');
  const [courseYears, setCourseYears] = useState('1');
  const [checkedDocs, setCheckedDocs] = useState<string[]>(UKVI_DOC_CHECKLIST.slice(0, 3));

  const matchedUnis = useMemo(() => {
    const g = parseFloat(gpa) || 0;
    const i = parseFloat(ielts) || 0;
    const budget = parseFloat(maxTuition) || 99999;
    return UNIVERSITY_CATALOG.filter(
      (u) => g >= u.minGpa && i >= u.minIelts && u.tuitionGbp - u.scholarshipMaxGbp <= budget,
    );
  }, [gpa, ielts, maxTuition]);

  const casCalc = useMemo(() => {
    const monthly = studyZone === 'london' ? 1334 : 1023;
    const maintenance9Mo = monthly * 9;
    const unpaidTuition = Math.max(0, (parseFloat(tuitionYear1) || 0) - (parseFloat(depositPaid) || 0));
    const totalCasBankGbp = maintenance9Mo + unpaidTuition;
    const years = Math.max(1, parseFloat(courseYears) || 1);
    const ihsTotalGbp = Math.round(years * 776);
    const visaFeeGbp = 490;
    return { monthly, maintenance9Mo, unpaidTuition, totalCasBankGbp, ihsTotalGbp, visaFeeGbp };
  }, [studyZone, tuitionYear1, depositPaid, courseYears]);

  async function saveApplicantToCrm() {
    if (!studentName.trim()) {
      toast.error('Enter student applicant name first');
      return;
    }
    try {
      await apiFetch('/api/crm/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: studentName,
          email: studentEmail || undefined,
          source: 'UKVI Study-Abroad Hub',
          status: 'qualified',
          score: 82,
          notes: `GPA: ${gpa}, IELTS: ${ielts}, Matched Unis: ${matchedUnis.map((m) => m.name).join(', ')}. Required CAS Bank Funds: £${casCalc.totalCasBankGbp.toLocaleString()}`,
        }),
      });
      toast.success(`Added ${studentName} to CRM Pipeline with UKVI assessment notes`);
      setStudentName('');
      setStudentEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create CRM lead');
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Study-Abroad & UKVI Admissions Consultancy Hub</h1>
          <Badge variant="secondary">University Matcher · 28-Day CAS Calculator · Pre-CAS Mock · Intake Roadmap</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete international student counseling suite (ALO Education UK / Studytra / NextStep-Abroad / OpenMAIC) wired directly into your CRM.
        </p>
      </div>

      <Tabs defaultValue="matcher" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="matcher" className="gap-1.5"><GraduationCap className="h-4 w-4" /> University & Scholarship Matcher</TabsTrigger>
          <TabsTrigger value="cas" className="gap-1.5"><Calculator className="h-4 w-4" /> UKVI 28-Day CAS Calculator</TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1.5"><CheckSquare className="h-4 w-4" /> Document Checklist & Pre-CAS Interview</TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-1.5"><CalendarClock className="h-4 w-4" /> Intake Roadmap Planner</TabsTrigger>
        </TabsList>

        <TabsContent value="matcher">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Applicant Academic Profile</CardTitle>
                <CardDescription>Instant eligibility check & 1-click CRM intake</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Applicant Full Name</Label>
                    <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="e.g. Ayesha Rahman" />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="ayesha@example.com" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">CGPA (4.0 scale)</Label>
                    <Input value={gpa} onChange={(e) => setGpa(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">IELTS Overall</Label>
                    <Input value={ielts} onChange={(e) => setIelts(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Net Budget (£)</Label>
                    <Input value={maxTuition} onChange={(e) => setMaxTuition(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full" onClick={saveApplicantToCrm}>
                  <UserPlus className="mr-1.5 h-4 w-4" /> Create Qualified Student Lead in CRM
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Eligible Partner Universities ({matchedUnis.length})</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2.5 sm:grid-cols-2">
                {matchedUnis.map((u) => (
                  <div key={u.name} className="rounded-lg border p-3 text-xs space-y-1">
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-semibold text-sm">{u.name}</span>
                      <Badge variant="outline">{u.country}</Badge>
                    </div>
                    <div className="text-muted-foreground">{u.city} · Intakes: {u.intakes}</div>
                    <div className="font-medium text-emerald-600">
                      Tuition £{u.tuitionGbp.toLocaleString()} (Up to £{u.scholarshipMaxGbp.toLocaleString()} scholarship)
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cas">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">UKVI Student Route Financial Parameters</CardTitle>
                <CardDescription>Calculates exact 28-day bank statement balance required for CAS & Visa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={studyZone === 'london' ? 'default' : 'outline'}
                    className="flex-1 text-xs"
                    onClick={() => setStudyZone('london')}
                  >
                    Inner/Greater London (£1,334/mo)
                  </Button>
                  <Button
                    type="button"
                    variant={studyZone === 'outside' ? 'default' : 'outline'}
                    className="flex-1 text-xs"
                    onClick={() => setStudyZone('outside')}
                  >
                    Outside London (£1,023/mo)
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Year-1 Tuition (£)</Label>
                    <Input value={tuitionYear1} onChange={(e) => setTuitionYear1(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Deposit Paid (£)</Label>
                    <Input value={depositPaid} onChange={(e) => setDepositPaid(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Course Years</Label>
                    <Input value={courseYears} onChange={(e) => setCourseYears(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Required 28-Day Bank Statement Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-lg border p-3.5">
                  <div className="text-xs text-muted-foreground">9-Month Living Maintenance</div>
                  <div className="text-xl font-bold mt-0.5">£{casCalc.maintenance9Mo.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">9 × £{casCalc.monthly}/mo</div>
                </div>
                <div className="rounded-lg border p-3.5">
                  <div className="text-xs text-muted-foreground">Remaining First-Year Tuition</div>
                  <div className="text-xl font-bold mt-0.5">£{casCalc.unpaidTuition.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-primary bg-primary/5 p-3.5 sm:col-span-2">
                  <div className="text-xs font-semibold uppercase text-primary">Total Minimum 28-Day Bank Balance Required</div>
                  <div className="text-2xl font-bold mt-0.5">£{casCalc.totalCasBankGbp.toLocaleString()} GBP</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Plus Immigration Health Surcharge (~£{casCalc.ihsTotalGbp}) & Student Visa Application Fee (£{casCalc.visaFeeGbp}). Funds must never dip below this threshold for 28 consecutive days.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">UKVI Compliance File Checklist ({checkedDocs.length}/{UKVI_DOC_CHECKLIST.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {UKVI_DOC_CHECKLIST.map((doc) => {
                  const done = checkedDocs.includes(doc);
                  return (
                    <label key={doc} className="flex items-center gap-2.5 rounded border p-2.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() =>
                          setCheckedDocs((prev) => (prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]))
                        }
                      />
                      <span className={done ? 'line-through text-muted-foreground' : 'font-medium'}>{doc}</span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="lg:col-span-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-1.5">
                  <MessageCircleQuestion className="h-4 w-4" /> Pre-CAS Credibility Interview Simulator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {CREDIBILITY_QUESTIONS.map((item, idx) => (
                  <div key={idx} className="rounded-lg border p-3 text-xs space-y-1">
                    <div className="font-semibold">Q{idx + 1}: {item.q}</div>
                    <div className="text-muted-foreground"><strong>Compliance Rubric:</strong> {item.tip}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roadmap">
          <StudyRoadmapPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
