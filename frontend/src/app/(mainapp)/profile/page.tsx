"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useState } from "react";

export default function Profile() {
  const sampleInfo = {
    createdAt: Date.now(),
    user: {
      name: "Test Name",
    },
    role: "STUDENT",
    firstTime: false,
    gender: "MALE",
    dob: Date.now(),
    nationality: "Human",
    phone: "+971500000000",
    parentOneName: "Test Parent",
    parentOneEmail: "test@test.com",
    parentOnePhone: "+971500000000",
    church: {
      name: "Church Name",
      country: "Country",
    },
    primaryForChurch: false,
    // registrations: {

    // }
  };

  const [selectedOption, setSelectedOption] = useState(0);
  const [editMode, setEditMode] = useState(false);

  const editDetails = async () => {
    if (!editMode) setEditMode(true);
    else {
      // submit PUT request for profile data
      setEditMode(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="w-full max-w-6xl min-w-72 p-4 flex flex-col gap-4 rounded-lg">
        <h1 className="text-2xl font-bold">My Account</h1>
        <div className="grid grid-cols-5 gap-4">
          <div className="flex flex-col gap-4 p-4 rounded-lg border col-span-1 h-fit">
            <button
              onClick={() => setSelectedOption(0)}
              className={`w-full text-left hover:text-primary cursor-pointer ${selectedOption === 0 ? "font-bold" : ""}`}
            >
              Profile
            </button>
            <button
              onClick={() => setSelectedOption(1)}
              className={`w-full text-left hover:text-primary cursor-pointer ${selectedOption === 1 ? "font-bold" : ""}`}
            >
              Settings
            </button>
          </div>
          {selectedOption === 0 && (
            <div className="flex p-4 rounded-lg border col-span-4">
              <div className="flex flex-col gap-4 w-full">
                <div className="flex w-full justify-between items-center">
                  <h2 className="text-xl font-bold">Profile</h2>
                  <Button onClick={editDetails} className="text-primary-foreground">
                    {editMode ? "Save" : "Edit"}
                  </Button>
                </div>
                <hr />
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Role: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border capitalize"
                    value={sampleInfo.role.toLowerCase()}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Phone: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={sampleInfo.phone}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Church: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={sampleInfo.church.country}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Country: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={sampleInfo.church.country}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Date of Birth: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={new Date(sampleInfo.dob).toLocaleDateString()}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Gender: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border capitalize"
                    value={sampleInfo.gender.toLowerCase()}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Nationality: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={sampleInfo.nationality}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Parent Name: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={sampleInfo.parentOneName}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Parent Email: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={sampleInfo.parentOneEmail}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Parent Phone: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={sampleInfo.parentOnePhone}
                  />
                </div>
              </div>
            </div>
          )}
          {selectedOption === 1 && (
            <div className="flex p-4 rounded-lg border col-span-4">
              <div className="flex flex-col gap-4 w-full">
                <h2 className="text-xl font-bold">Settings</h2>
                <hr />
                <div className="flex flex-col gap-2 rounded-lg w-full">
                  <p className="font-bold">Account Settings</p>
                  <div className="flex items-center gap-2">
                    <p className="min-w-72 w-1/2">Change your password</p>
                    <Button className="justify-center text-primary-foreground min-w-72 w-1/2">
                      Reset Password
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="min-w-72 w-1/2">Change your email</p>
                    <Button className="justify-center text-primary-foreground min-w-72 w-1/2">
                      Reset Email
                    </Button>
                  </div>
                  {/* <hr className="my-4" />
                  <p className="font-bold">Delete Account</p>
                  <div className="flex items-center gap-2">
                    <p className="min-w-72 w-1/2">
                      This option deletes all your identity data from
                      CrossCurrent's events platform. Some information is
                      retained to keep records of registrations and previous
                      events, but all identifying data is removed.{" "}
                      <span className="font-bold">
                        This choice cannot be reversed - be completely sure!
                      </span>
                    </p>
                    <Button className="justify-center text-white min-w-72 w-1/2 bg-red-700">
                      Delete Account
                    </Button>
                  </div> */}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
