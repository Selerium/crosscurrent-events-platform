"use client";

import { useState, type ComponentType } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  CircleDollarSign,
  Crown,
  FileCheck,
  HandCoins,
  IdCard,
  LogIn,
  MailCheck,
  MapPin,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type RoleId = "youthDirector" | "leader" | "student";

type Step = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  href?: string;
  cta?: string;
};

type Tutorial = {
  id: RoleId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tagline: string;
  intro: string;
  steps: Step[];
  capabilities: string[];
};

const TUTORIALS: Tutorial[] = [
  {
    id: "youthDirector",
    label: "Youth Director",
    icon: Crown,
    tagline: "You run the youth group at your church.",
    intro:
      "As your church's primary contact you manage membership — approving leaders and students — and you take care of scholarships and payments.",
    capabilities: [
      "Approve leaders & students",
      "Manage your roster",
      "Bulk scholarship payments",
      "Register as a leader",
    ],
    steps: [
      {
        icon: UserPlus,
        title: "Create your account",
        body: "Sign up with your name and email, then click the verification link we send you to activate your account.",
        href: "/register",
        cta: "Create account",
      },
      {
        icon: IdCard,
        title: "Complete your profile",
        body: "Choose \u201cLeader\u201d as your role, add your details, and select the church you serve at.",
      },
      {
        icon: BadgeCheck,
        title: "Become the primary contact",
        body: "The platform admin marks you as your church's primary contact. This gives you full management powers over the group. A team member will reach out to you, or you can contact them at hello@eyu.ae (email).",
      },
      {
        icon: ShieldCheck,
        title: "Approve members",
        body: "In My Church, use \u201cApprove Students\u201d and \u201cApprove Leaders\u201d to accept everyone who has requested to join your group.",
        href: "/my-church",
        cta: "Open My Church",
      },
      {
        icon: Users,
        title: "Manage your roster",
        body: "View and filter your members by role, and remove anyone who no longer belongs to the group.",
      },
      {
        icon: FileCheck,
        title: "Register as a leader",
        body: "Upload your safeguarding/DBS certificate and pick a primary role plus three secondary roles when you register for an event.",
      },
      {
        icon: HandCoins,
        title: "Handle scholarships",
        body: "Review the \u201cself-pay\u201d registrations from your church and pay for them together in one Stripe payment.",
      },
      {
        icon: CalendarDays,
        title: "See who\u2019s signed up",
        body: "Every event shows you who from your church has registered, so you always know the numbers.",
        href: "/dashboard",
        cta: "Open Dashboard",
      },
    ],
  },
  {
    id: "leader",
    label: "Leader",
    icon: Shield,
    tagline: "You volunteer at the youth group.",
    intro:
      "As a volunteer you help run events and approve student members. You register alongside the team with a safeguarding certificate.",
    capabilities: [
      "Approve students",
      "Leader registration",
      "Scholarship payments",
      "Registrant list",
    ],
    steps: [
      {
        icon: UserPlus,
        title: "Create your account",
        body: "Sign up with your name and email, then click the verification link we send you to activate your account.",
        href: "/register",
        cta: "Create account",
      },
      {
        icon: IdCard,
        title: "Complete your profile",
        body: "Choose \u201cLeader\u201d as your role, add your details, and select the church where you serve.",
      },
      {
        icon: UserCheck,
        title: "Get approved",
        body: "Your youth director approves your membership before you get access to the group.",
      },
      {
        icon: Shield,
        title: "Approve students",
        body: "From My Church you can approve the students joining your group. Leaders are approved by the youth director only.",
        href: "/my-church",
        cta: "Open My Church",
      },
      {
        icon: FileCheck,
        title: "Register for events",
        body: "Include your safeguarding/DBS certificate, a primary role, and exactly three secondary roles when you register.",
      },
      {
        icon: HandCoins,
        title: "Handle scholarships",
        body: "Pay for the students from your church who asked for payment support, in one bulk Stripe payment.",
      },
      {
        icon: CalendarDays,
        title: "See who\u2019s signed up",
        body: "Each event shows the registrants from your church so you can coordinate your team.",
        href: "/dashboard",
        cta: "Open Dashboard",
      },
    ],
  },
  {
    id: "student",
    label: "Students",
    icon: Users,
    tagline: "You\u2019re a teen in the youth group.",
    intro:
      "You register for events, your parents verify your registration, and you pay yourself or ask your church to cover your spot.",
    capabilities: [
      "Event registration",
      "Parent verification",
      "Self-pay or scholarship",
      "Room & group details",
    ],
    steps: [
      {
        icon: UserPlus,
        title: "Create your account",
        body: "Sign up with your name and email, then click the verification link we send you to activate your account.",
        href: "/register",
        cta: "Create account",
      },
      {
        icon: IdCard,
        title: "Complete your profile",
        body: "Choose \u201cStudent\u201d as your role, add a parent or guardian contact, and pick your church.",
      },
      {
        icon: UserCheck,
        title: "Get approved",
        body: "A leader from your church approves your membership before you can register for events.",
      },
      {
        icon: CalendarDays,
        title: "Register for an event",
        body: "Pick your shirt size, say whether you\u2019ll swim, and add your medications, allergies, and emergency contacts.",
        href: "/dashboard",
        cta: "Open Dashboard",
      },
      {
        icon: CircleDollarSign,
        title: "Self-pay or scholarship",
        body: "Choose to pay for your spot yourself, or ask the church to cover it.",
      },
      {
        icon: MailCheck,
        title: "Parent verification",
        body: "Your parent clicks the link emailed to them to approve your registration \u2014 this is required before you can pay.",
      },
      {
        icon: Sparkles,
        title: "Pay for your spot",
        body: "Complete card payment to confirm your registration, or your church pays for you.",
      },
      {
        icon: MapPin,
        title: "See your details",
        body: "After payment, the event page shows your room and group so you know where you\u2019re staying.",
      },
    ],
  },
];

export function TutorialLanding() {
  const [activeId, setActiveId] = useState<RoleId>("student");
  const [announcementOpen, setAnnouncementOpen] = useState(true);
  const tutorial = TUTORIALS.find((t) => t.id === activeId)!;

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 flex-col items-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-6xl">
          <section className="flex flex-col items-center gap-5 text-center">
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How CrossCurrent works
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              {
                "The one central platform for all things UAE YFC - just create an account, join your church, and register for Big Weekend. Your details are saved for every event and won't need re-registering each time."
              }
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <a href="/register">
                  Get started <ArrowRight className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/login">
                  <LogIn className="size-4" /> Sign in
                </a>
              </Button>
            </div>
          </section>

          <section className="mt-12">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Which one are you?
              </span>
              <div className="grid w-full max-w-xl grid-cols-3 rounded-lg border bg-background p-1">
                {TUTORIALS.map((t) => {
                  const Icon = t.icon;
                  const active = t.id === activeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveId(t.id)}
                      aria-pressed={active}
                      className={`flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors cursor-pointer ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span className="hidden sm:inline">{t.label}</span>
                      <span className="sm:hidden">{t.label.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-lg border bg-card p-6">
                <h2 className="text-xl font-bold text-foreground">
                  {tutorial.label}
                </h2>
                <p className="font-medium text-foreground">
                  {tutorial.tagline}
                </p>
                <p className="text-muted-foreground">{tutorial.intro}</p>
                <div className="flex flex-wrap gap-2">
                  {tutorial.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {tutorial.steps.map((step, idx) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.title}
                      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="size-4 text-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-foreground">
                            {step.title}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {step.body}
                      </p>
                      {step.href && step.cta && (
                        <Button asChild variant="outline" size="sm">
                          <a href={step.href}>
                            {step.cta} <ArrowRight className="size-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mt-12 flex flex-col items-center gap-3 text-center">
            <Bell className="size-8 text-muted-foreground" />
            <p className="max-w-xl text-muted-foreground">
              You&rsquo;ll get notified in-app whenever your registration is
              updated, your membership is approved, or payment is confirmed.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <a href="/register">
                  Get started <ArrowRight className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/login">
                  <LogIn className="size-4" /> Sign in
                </a>
              </Button>
            </div>
          </section>
        </div>
      </main>

      {announcementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg">
            <h2 className="text-xl font-bold text-foreground">
              Big Weekend 2026 registrations are officially open!
            </h2>
            <div className="flex flex-col gap-4 text-sm text-muted-foreground">
              <p>
                Hi! We&rsquo;re excited to announce that Big Weekend 2026
                registrations are <strong>OFFICIALLY OPEN</strong>!
              </p>
              <p>
                To sign up, we&rsquo;ve created a new platform this year that
                would help us as well as you and your youth groups to sign up
                for not just BW, but ANY event that we run in the UAE. You can
                register for an account right now to register for Big Weekend
                (please read through the tutorial on the homepage to understand
                how registration works).
              </p>
              <p>
                Upon registering, you choose your church and once approved by
                your church, you can sign up for all available events.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Youth group directors can manage youth leaders</li>
                <li>Leaders can manage students</li>
                <li>Students just have to sign up for events</li>
              </ul>
              <p>
                This process has been put in place to ensure that we can verify
                every church is represented properly by an actual member of your
                church. While the chances of false registrations are very
                minimal, this process makes sure to protect your churches and
                your groups.
              </p>
              <p>
                If you require any assistance with registering, please reach out
                to us on{" "}
                <a href="mailto:hello@eyu.ae" className="inline underline text-blue-400">
                  hello@eyu.ae
                </a>
              </p>
            </div>
            <Button
              className="mt-2 self-center"
              onClick={() => setAnnouncementOpen(false)}
            >
              Got it!
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
