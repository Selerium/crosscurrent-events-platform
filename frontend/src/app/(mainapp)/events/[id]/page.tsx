"use client";

import api from "@/lib/axios";
import {
  CalendarDays,
  ChevronLeft,
  Clock,
  MapPin,
  Phone,
  Users,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EventPage() {
  const eventInfo = {
    id: "1",
    name: "Big Weekend 2026",
    brief:
      "UAEYFC's annual 3-day weekend youth retreat for teens and leaders across the UAE.",
    startDate: new Date(),
    endDate: new Date(),
    signedUp: 100,
    maxSignUps: 300,
    location: "Ras Al Khaimah",
    price: 530,
    user: {
      paid: true,
      room: {
        name: "Room 001",
        members: [
          { name: "Person 1", mobile: "+971500000000" },
          { name: "Person 2", mobile: "+971500000000" },
          { name: "Person 3", mobile: "+971500000000" },
        ],
      },
      group: "Colour 01",
      swimming: true,
      allergies: ["Allergy 1", "Allergy 2"],
      medication: ["Medication 1", "Medication 2"],
      identityDocument: "/file.svg",
    },
    schedule: [
      [
        {
          item: "Day 1 Item 1",
          description: "Description of the item",
          startTime: new Date(),
          endTime: new Date(),
          location: "Location",
        },
        {
          item: "Day 1 Item 2",
          description: "Description of the item",
          startTime: new Date(),
          endTime: new Date(),
          location: "Location",
        },
        {
          item: "Day 1 Item 3",
          description: "Description of the item",
          startTime: new Date(),
          endTime: new Date(),
          location: "Location",
        },
      ],
      [
        {
          item: "Day 2 Item 1",
          description: "Description of the item",
          startTime: new Date(),
          endTime: new Date(),
          location: "Location",
        },
        {
          item: "Day 2 Item 2",
          description: "Description of the item",
          startTime: new Date(),
          endTime: new Date(),
          location: "Location",
        },
        {
          item: "Day 2 Item 3",
          description: "Description of the item",
          startTime: new Date(),
          endTime: new Date(),
          location: "Location",
        },
      ],
      [
        {
          item: "Day 3 Item 1",
          description: "Description of the item",
          startTime: new Date(),
          endTime: new Date(),
          location: "Location",
        },
        {
          item: "Day 3 Item 2",
          description: "Description of the item",
          startTime: new Date(),
          endTime: new Date(),
          location: "Location",
        },
        {
          item: "Day 3 Item 3",
          description: "Description of the item",
          startTime: new Date(),
          endTime: new Date(),
          location: "Location",
        },
      ],
    ],
  };

  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [eventData, setEventData] = useState();
  const [selectedDay, setSelectedDay] = useState(0);
  const [expandID, setExpandID] = useState(false);

  // useEffect(() => {
  //     const fetchData = async () => {
  //         const eventInfo = await api.get(`/event/${params.id}`)
  //     };
  // }, [])

  return (
    <>
      {eventInfo.user && expandID && (
        <div className="fixed top-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
          <div className="flex flex-col p-4 grow m-4 md:m-10 relative border rounded-lg bg-white gap-2">
            <div className="flex justify-between">
              <span className="font-bold">ID Document</span>
              <button
                onClick={() => setExpandID(false)}
                className="cursor-pointer"
              >
                <XIcon width={24} height={24} />
              </button>
            </div>
            <div className="w-full aspect-video relative rounded-lg border">
              <Image
                src={eventInfo.user.identityDocument}
                fill
                alt="ID document image"
              />
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-center p-4 sm:px-6">
        <div className="w-full max-w-6xl p-4 flex flex-col gap-4 rounded-lg border">
          <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
            <div className="flex flex-col items-start gap-2">
              <button
                className="flex items-center cursor-pointer"
                onClick={() => router.back()}
              >
                <ChevronLeft width={20} height={20} /> Back
              </button>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-2xl">{eventInfo.name}</h1>
                {eventInfo.user && (
                  <span
                    className={`py-2 px-4 rounded-lg w-fit ${eventInfo.user.paid ? "bg-green-800" : "bg-red-800"} text-center text-white font-bold`}
                  >
                    {eventInfo.user.paid ? "PAID" : "PAYMENT PENDING"}
                  </span>
                )}
              </div>
              <p>{eventInfo.brief}</p>
            </div>
            <div className="flex justify-center flex-col gap-2">
              <span className="flex gap-2">
                <CalendarDays width={24} height={24} />{" "}
                {eventInfo.startDate.toLocaleDateString("en-UK", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="flex gap-2">
                <MapPin width={24} height={24} /> {eventInfo.location}
              </span>
              <span className="flex gap-2">
                <Users width={24} height={24} /> {eventInfo.signedUp} /{" "}
                {eventInfo.maxSignUps}
              </span>
            </div>
          </div>
          <hr />
          <div className="grid lg:grid-cols-3 grid-cols-1 gap-4">
            <div className="col-span-1 order-2 lg:order-1 lg:col-span-2 flex flex-col gap-2">
              <hr className="block md:hidden" />
              <span className="font-bold">Schedule</span>
              <div className="flex gap-2">
                {eventInfo.schedule.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(idx)}
                    className={`py-2 px-4 border w-fit rounded-lg transition-all cursor-pointer ${selectedDay == idx ? "bg-neutral-600 text-white font-bold" : ""}`}
                  >
                    Day {idx + 1}
                  </button>
                ))}
              </div>
              {eventInfo.schedule[selectedDay].map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col md:flex-row justify-between border p-4 rounded-lg gap-2"
                >
                  <div className="flex flex-col gap-2">
                    <span className="font-bold">{item.item}</span>
                    <span>{item.description}</span>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <p className="w-full md:w-fit uppercase rounded-lg p-4 border flex gap-2 items-center">
                      <Clock width={16} height={16} />
                      {item.startTime.toLocaleTimeString("en-UK", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}{" "}
                      -{" "}
                      {item.endTime.toLocaleTimeString("en-UK", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                    <p className="w-full md:w-fit rounded-lg p-4 border flex gap-2 items-center">
                      <MapPin width={16} height={16} /> {item.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="col-span-1 order-1 lg:order-2 flex flex-col gap-2 h-fit">
              {!eventInfo.user && (
                <button className="cursor-pointer p-4 rounded-lg w-full bg-neutral-200 font-bold">
                  REGISTER
                </button>
              )}
              {eventInfo.user && !eventInfo.user.paid && (
                <button className="cursor-pointer p-4 rounded-lg w-full bg-neutral-200 hover:bg-white hover:text-primary font-bold">
                  PAY FOR EVENT
                </button>
              )}
              {eventInfo.user && (
                <div className="flex flex-col gap-2">
                  <span className="font-bold">My Details</span>
                  <div className="flex flex-col gap-2 p-4 rounded-lg border">
                    <span className="font-bold">
                      {eventInfo.user.room.name}
                    </span>
                    {eventInfo.user.room.members.map((member) => (
                      <div
                        key={member.name}
                        className="flex items-center justify-between gap-2"
                      >
                        <span>{member.name}</span>
                        <div className="flex items-center gap-2">
                          <Phone width={14} height={14} />
                          <a
                            href={`tel:${member.mobile}`}
                            className="underline"
                          >
                            {member.mobile}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between gap-2 p-4 rounded-lg border">
                    <span className="font-bold">Group</span>
                    <span>{eventInfo.user.group}</span>
                  </div>
                  <div className="flex flex-col gap-2 p-4 rounded-lg border">
                    <span className="font-bold">Allergies</span>
                    {eventInfo.user.allergies.map((allergy) => (
                      <span key={allergy}>{allergy}</span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 p-4 rounded-lg border">
                    <span className="font-bold">Medication</span>
                    {eventInfo.user.medication.map((medication) => (
                      <span key={medication}>{medication}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-4 rounded-lg border">
                    <span className="font-bold">Swimming</span>
                    <span
                      className={`${eventInfo.user.swimming ? "bg-green-800" : "bg-red-800"} rounded-lg px-4 py-2 text-white font-bold`}
                    >
                      {eventInfo.user.swimming ? "YES" : "NO"}
                    </span>
                  </div>
                  <div
                    onClick={() => setExpandID(true)}
                    className="flex flex-col gap-2 p-4 rounded-lg border cursor-pointer"
                  >
                    <div className="flex justify-between">
                      <span className="font-bold">ID Document</span>
                      <span>(click to view)</span>
                    </div>
                    <div className="w-full aspect-video relative rounded-lg border">
                      <Image
                        src={eventInfo.user.identityDocument}
                        fill
                        alt="ID document image"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
