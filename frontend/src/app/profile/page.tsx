"use client";

import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { toast } from "sonner";

type ProfileData = {
  createdAt: string;
  user: { name: string; email: string };
  role: string;
  firstTime: boolean;
  gender: string | null;
  dob: string | null;
  nationality: string | null;
  phone: string | null;
  parentOneName: string | null;
  parentOneEmail: string | null;
  parentOnePhone: string | null;
  church: { id: string; name: string; country: string; state: string };
  churchId: string;
  primaryForChurch: boolean;
};

export default function Profile() {
  if (process.env.NEXT_PUBLIC_DISABLE_APP === "true") {
    redirect("/");
  }

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [selectedOption, setSelectedOption] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    nationality: "",
    parentOneName: "",
    parentOneEmail: "",
    parentOnePhone: "",
  });

  const [passwordModal, setPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", newPassword: "", confirm: "" });

  const [emailModal, setEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ current: "", newEmail: "" });

  useEffect(() => {
    const fetchProfile = async () => {
      const res = await api.get("/profile");
      setProfile(res.data.data);
      const p = res.data.data;
      setForm({
        phone: p.phone || "",
        nationality: p.nationality || "",
        parentOneName: p.parentOneName || "",
        parentOneEmail: p.parentOneEmail || "",
        parentOnePhone: p.parentOnePhone || "",
      });
    };

    fetchProfile();
  }, []);

  const editDetails = async () => {
    if (!editMode) {
      setEditMode(true);
    } else {
      await api.put("/profile", form);
      const res = await api.get("/profile");
      setProfile(res.data.data);
      setEditMode(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordForm.current || !passwordForm.newPassword || !passwordForm.confirm) {
      toast.warning("Please fill out all fields.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.warning("New password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      toast.warning("New passwords do not match.");
      return;
    }
    try {
      await api.put("/profile/password", {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.newPassword,
      });
      toast.success("Password updated.");
      setPasswordModal(false);
      setPasswordForm({ current: "", newPassword: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update password.");
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailForm.current || !emailForm.newEmail) {
      toast.warning("Please fill out all fields.");
      return;
    }
    try {
      await api.put("/profile/email", {
        currentPassword: emailForm.current,
        newEmail: emailForm.newEmail,
      });
      toast.success("Email updated.");
      setEmailModal(false);
      setEmailForm({ current: "", newEmail: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update email.");
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center p-4 sm:px-6">
        <div className="w-full max-w-6xl min-w-72 p-4">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4 sm:px-6">
      <div className="w-full max-w-6xl min-w-72 p-4 flex flex-col gap-4 rounded-lg">
        <h1 className="text-2xl font-bold">My Account</h1>
        <div className="grid grid-cols-5 gap-4">
          <div className="flex flex-col gap-4 p-4 rounded-lg border col-span-1 h-fit">
            <button
              onClick={() => setSelectedOption(0)}
              className={`w-full text-left hover:text-primary cursor-pointer ${
                selectedOption === 0 ? "font-bold" : ""
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setSelectedOption(1)}
              className={`w-full text-left hover:text-primary cursor-pointer ${
                selectedOption === 1 ? "font-bold" : ""
              }`}
            >
              Settings
            </button>
          </div>
          {selectedOption === 0 && (
            <div className="flex p-4 rounded-lg border col-span-4">
              <div className="flex flex-col gap-4 w-full">
                <div className="flex w-full justify-between items-center">
                  <h2 className="text-xl font-bold">Profile</h2>
                  <Button
                    onClick={editDetails}
                  >
                    {editMode ? "Save" : "Edit"}
                  </Button>
                </div>
                <hr />
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Role: </p>
                  <Input
                    disabled
                    className="min-w-72 grow px-4 py-2 rounded-lg border capitalize"
                    value={profile.role.toLowerCase()}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Phone: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={editMode ? form.phone : profile.phone || ""}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Church: </p>
                  <Input
                    disabled
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={profile.church ? `${profile.church.name} ${localStorage.getItem("approved") === "false" ? "(pending approval)" : "" }` : "-"}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Country: </p>
                  <Input
                    disabled
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={profile.church ? profile.church.country : "-"}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Date of Birth: </p>
                  <Input
                    disabled
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={
                      profile.dob
                        ? new Date(profile.dob).toLocaleDateString()
                        : "-"
                    }
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Gender: </p>
                  <Input
                    disabled
                    className="min-w-72 grow px-4 py-2 rounded-lg border capitalize"
                    value={profile.gender ? profile.gender.toLowerCase() : "-"}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg w-full">
                  <p className="w-72">Nationality: </p>
                  <Input
                    disabled={!editMode}
                    className="min-w-72 grow px-4 py-2 rounded-lg border"
                    value={
                      editMode ? form.nationality : profile.nationality || "-"
                    }
                    onChange={(e) =>
                      setForm({ ...form, nationality: e.target.value })
                    }
                  />
                </div>
                {localStorage.getItem('role') === "STUDENT" &&
                  <>
                    <div className="flex items-center gap-2 rounded-lg w-full">
                      <p className="w-72">Parent Name: </p>
                      <Input
                        disabled={!editMode}
                        className="min-w-72 grow px-4 py-2 rounded-lg border"
                        value={
                          editMode
                            ? form.parentOneName
                            : profile.parentOneName || "-"
                        }
                        onChange={(e) =>
                          setForm({ ...form, parentOneName: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-lg w-full">
                      <p className="w-72">Parent Email: </p>
                      <Input
                        disabled={!editMode}
                        className="min-w-72 grow px-4 py-2 rounded-lg border"
                        value={
                          editMode
                            ? form.parentOneEmail
                            : profile.parentOneEmail || "-"
                        }
                        onChange={(e) =>
                          setForm({ ...form, parentOneEmail: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-lg w-full">
                      <p className="w-72">Parent Phone: </p>
                      <Input
                        disabled={!editMode}
                        className="min-w-72 grow px-4 py-2 rounded-lg border"
                        value={
                          editMode
                            ? form.parentOnePhone
                            : profile.parentOnePhone || "-"
                        }
                        onChange={(e) =>
                          setForm({ ...form, parentOnePhone: e.target.value })
                        }
                      />
                    </div>
                  </>
                }
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
                    <Button
                      className="justify-center min-w-72 w-1/2"
                      onClick={() => setPasswordModal(true)}
                    >
                      Reset Password
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="min-w-72 w-1/2">Change your email</p>
                    <Button
                      className="justify-center min-w-72 w-1/2"
                      onClick={() => setEmailModal(true)}
                    >
                      Reset Email
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-bold mb-4">Reset Password</h3>
            <div className="flex flex-col gap-3">
              <PasswordInput
                placeholder="Current password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
              />
              <PasswordInput
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
              <PasswordInput
                placeholder="Confirm new password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setPasswordModal(false);
                  setPasswordForm({ current: "", newPassword: "", confirm: "" });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handlePasswordSubmit}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-bold mb-4">Reset Email</h3>
            <div className="flex flex-col gap-3">
              <PasswordInput
                placeholder="Current password"
                value={emailForm.current}
                onChange={(e) => setEmailForm({ ...emailForm, current: e.target.value })}
              />
              <Input
                type="email"
                placeholder="New email"
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setEmailModal(false);
                  setEmailForm({ current: "", newEmail: "" });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEmailSubmit}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
