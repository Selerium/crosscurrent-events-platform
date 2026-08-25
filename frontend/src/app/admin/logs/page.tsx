"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Pagination } from "@/components/ui/pagination";
import type { AdminLogRecord, PaginatedResponse } from "../data";

const API = process.env.NEXT_PUBLIC_API_URL;

const actionLabels: Record<string, string> = {
  "church.create": "Church Created",
  "church.update": "Church Updated",
  "church.delete": "Church Deleted",
  "church.member.approve": "Member Approved",
  "church.member.reject": "Member Rejected",
  "event.create": "Event Created",
  "event.update": "Event Updated",
  "profile.delete": "Profile Deleted",
  "profile.update": "Profile Updated",
  "admin.create": "Admin Created",
};

const targetTypeLabels: Record<string, string> = {
  church: "Church",
  event: "Event",
  profile: "Profile",
  user: "User",
};

const PAGE_SIZE = 15;

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLogRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/admin/logs`, { params: { page, limit: PAGE_SIZE } })
      .then((r) => {
        setLogs(r.data.data);
        setTotalPages(r.data.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Logs</h1>
      <p className="text-gray-500 mb-8">Audit trail of all admin actions.</p>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No logs found.</div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{log.adminName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {targetTypeLabels[log.targetType] || log.targetType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {log.success ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Success</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
