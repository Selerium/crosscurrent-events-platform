// import Link from "next/link";
// import Image from "next/image";
// import { Button } from "@/components/ui/button";
// import {
//   CalendarDays,
//   Church,
//   ClipboardCheck,
//   Mail,
//   MapPin,
//   Shield,
//   Users,
// } from "lucide-react";

// export default function Home() {
//   return (
//     <div className="flex min-h-full flex-col">
//       {/* Hero */}
//       <section className="flex flex-col items-center px-4 py-20 text-center sm:px-6">
//         <Image
//           src="/cc-long.png"
//           alt="CrossCurrent"
//           width={274}
//           height={136}
//           className="brand-logo-light mb-6 h-14 w-auto"
//           priority
//         />
//         <Image
//           src="/cc-long-white.png"
//           alt="CrossCurrent"
//           width={274}
//           height={136}
//           className="brand-logo-dark mb-6 hidden h-14 w-auto"
//           priority
//         />
//         <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
//           Events and registration for your church youth group
//         </h1>
//         <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
//           CrossCurrent brings church leaders and students together for
//           retreats, conferences, and youth events — all in one place.
//         </p>
//         <div className="mt-10 flex flex-col gap-3 sm:flex-row">
//           <Button asChild size="lg">
//             <Link href="/register">Get started</Link>
//           </Button>
//           <Button asChild variant="outline" size="lg">
//             <Link href="/login">Sign in</Link>
//           </Button>
//         </div>
//       </section>

//       {/* Features */}
//       <section className="border-t bg-card/50 px-4 py-20 sm:px-6">
//         <div className="mx-auto max-w-6xl">
//           <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground">
//             Everything you need
//           </h2>
//           <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
//             Built for church leaders organizing events and students joining
//             them.
//           </p>
//           <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
//             <FeatureCard
//               icon={<CalendarDays className="size-5" />}
//               title="Browse & register for events"
//               description="See upcoming retreats, conferences, and youth events. Register in seconds with your shirt size, dietary needs, and more."
//             />
//             <FeatureCard
//               icon={<Church className="size-5" />}
//               title="Church-managed groups"
//               description="Each church has its own space with a primary contact and approved members, keeping your group organized."
//             />
//             <FeatureCard
//               icon={<Shield className="size-5" />}
//               title="Approval system"
//               description="Leaders approve students and new members before they can register, so only verified participants join your events."
//             />
//             <FeatureCard
//               icon={<ClipboardCheck className="size-5" />}
//               title="Simple event management"
//               description="Admins create events with schedules, pricing, early-bird deals, and capacity limits — all in a few clicks."
//             />
//             <FeatureCard
//               icon={<Users className="size-5" />}
//               title="Participant overview"
//               description="See who's registered, who's paid, dietary restrictions, room assignments, and emergency contacts at a glance."
//             />
//             <FeatureCard
//               icon={<MapPin className="size-5" />}
//               title="Multi-church platform"
//               description="Supports churches across the UAE and beyond, with region-based grouping and easy church selection."
//             />
//           </div>
//         </div>
//       </section>

//       {/* How it works */}
//       <section className="px-4 py-20 sm:px-6">
//         <div className="mx-auto max-w-4xl">
//           <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground">
//             How it works
//           </h2>
//           <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
//             From sign-up to event day in four simple steps.
//           </p>
//           <div className="mt-12 grid gap-8 sm:grid-cols-2">
//             <Step
//               number={1}
//               title="Create your account"
//               description="Sign up with your email, fill in your profile, and select your church."
//             />
//             <Step
//               number={2}
//               title="Get approved"
//               description="Your church leader reviews and approves your account so you can start registering."
//             />
//             <Step
//               number={3}
//               title="Register for events"
//               description="Browse available events, fill out the registration form, and submit — it only takes a minute."
//             />
//             <Step
//               number={4}
//               title="Show up & connect"
//               description="Attend the event, meet your group, and enjoy. Your room, schedule, and details are all here."
//             />
//           </div>
//         </div>
//       </section>

//       {/* CTA */}
//       <section className="border-t bg-card/50 px-4 py-20 sm:px-6">
//         <div className="mx-auto max-w-2xl text-center">
//           <h2 className="text-3xl font-semibold tracking-tight text-foreground">
//             Ready to join?
//           </h2>
//           <p className="mt-3 text-muted-foreground">
//             Create your account today and get connected with your church youth
//             group.
//           </p>
//           <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
//             <Button asChild size="lg">
//               <Link href="/register">Create account</Link>
//             </Button>
//             <Button asChild variant="outline" size="lg">
//               <Link href="/login">Sign in</Link>
//             </Button>
//           </div>
//         </div>
//       </section>

//       {/* Contact */}
//       <section className="border-t px-4 py-20 sm:px-6">
//         <div className="mx-auto max-w-md text-center">
//           <h2 className="text-2xl font-semibold tracking-tight text-foreground">
//             Get in touch
//           </h2>
//           <p className="mt-3 text-muted-foreground">
//             Have questions or need help? Reach out and we&apos;ll get back to
//             you.
//           </p>
//           <a
//             href="mailto:hello@eyu.ae"
//             className="mt-6 inline-flex items-center gap-2 rounded-lg border bg-card px-6 py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-card/80"
//           >
//             <Mail className="size-4" />
//             hello@eyu.ae
//           </a>
//         </div>
//       </section>
//     </div>
//   );
// }

// function FeatureCard({
//   icon,
//   title,
//   description,
// }: {
//   icon: React.ReactNode;
//   title: string;
//   description: string;
// }) {
//   return (
//     <div className="rounded-lg border bg-card p-6 shadow-sm">
//       <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
//         {icon}
//       </div>
//       <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
//       <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
//         {description}
//       </p>
//     </div>
//   );
// }

// function Step({
//   number,
//   title,
//   description,
// }: {
//   number: number;
//   title: string;
//   description: string;
// }) {
//   return (
//     <div className="flex gap-4">
//       <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
//         {number}
//       </div>
//       <div>
//         <h3 className="font-semibold text-foreground">{title}</h3>
//         <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
//           {description}
//         </p>
//       </div>
//     </div>
//   );
// }

export default function Home() {
  return (
    <div>
      <h1>Hello Vercel</h1>
    </div>
  );
}