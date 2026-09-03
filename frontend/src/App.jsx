import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  Home,
  Link2,
  ListChecks,
  LogOut,
  MessageCircle,
  Play,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API = import.meta.env.VITE_API_URL || "";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);

const NAV = [
  [Home, "Dashboard"],
  [ListChecks, "Transactions"],
  [AlertTriangle, "Failed Payments"],
  [Link2, "Recovery Links"],
  [BarChart3, "Analytics"],
  [RefreshCw, "Reconciliation"],
  [Bot, "AI Assistant"],
  [FileText, "Audit Logs"],
  [Settings, "Settings"],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getRecoveryProbability(tx) {
  if (!tx) return 0;

  if (tx.failure === "Issuer Bank Outage") return 86;
  if (tx.failure === "Network Timeout") return 91;
  if (tx.failure === "Card Decline") return 72;

  return 65;
}

function getExpectedRecovery(tx) {
  if (!tx) return 0;

  const probability = getRecoveryProbability(tx);

  return Math.round(tx.amount * (probability / 100));
}

export default function App() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState("Dashboard");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [failureFilter, setFailureFilter] = useState("All");
  const [amountFilter, setAmountFilter] = useState("All");

  const [selected, setSelected] = useState(null);
  const [customerModal, setCustomerModal] = useState(null);
  const [auditModal, setAuditModal] = useState(null);

  const [chat, setChat] = useState([
    {
      role: "assistant",
      kind: "text",
      text: "Hello Admin! I’m your AI copilot for payment recovery. Ask me anything or try the suggestions below.",
    },
  ]);

  const [input, setInput] = useState("");
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState("");
  const [events, setEvents] = useState([]);
  const [auditRows, setAuditRows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [demoRunning, setDemoRunning] = useState(false);
  
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoStage, setDemoStage] = useState(0);
  const [demoTransaction, setDemoTransaction] = useState(null);

  const [recoverySuccess, setRecoverySuccess] = useState(null);

  const [chartRange, setChartRange] = useState("7D");

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(""), 2400);
  };

  async function load() {
    try {
      setError("");
      const response = await fetch(`${API}/api/dashboard`);

      if (!response.ok) {
        throw new Error("Could not load dashboard");
      }

      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Unable to connect to backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API}/api/events`);

    es.onopen = () => setLive(true);

    es.onerror = () => {
      setLive(false);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        setEvents((old) => [parsed, ...old].slice(0, 10));
      } catch {
        // Ignore malformed demo event.
      }
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (page === "Audit Logs") {
      loadAudits();
    }
  }, [page, data]);

  const transactions = useMemo(() => {
    let rows = data?.transactions || [];

    if (query.trim()) {
      const q = query.toLowerCase();

      rows = rows.filter((tx) =>
        [
          tx.id,
          tx.failure,
          tx.customer,
          tx.status,
          tx.strategy,
          tx.error_code,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (statusFilter !== "All") {
      rows = rows.filter((tx) => tx.status === statusFilter);
    }

    if (failureFilter !== "All") {
      rows = rows.filter((tx) => tx.failure === failureFilter);
    }

    if (amountFilter === "High") {
      rows = rows.filter((tx) => tx.amount >= 100000);
    }

    if (amountFilter === "Medium") {
      rows = rows.filter(
        (tx) => tx.amount >= 50000 && tx.amount < 100000
      );
    }

    if (amountFilter === "Low") {
      rows = rows.filter((tx) => tx.amount < 50000);
    }

    return rows;
  }, [data, query, statusFilter, failureFilter, amountFilter]);

  const failedTransactions = transactions;

  async function openRecovery(tx) {
    try {
      const response = await fetch(`${API}/api/transactions/${tx.id}`);

      if (!response.ok) {
        throw new Error("Unable to load recovery details");
      }

      setSelected(await response.json());
    } catch {
      showToast("Unable to load recovery link");
    }
  }

  async function openAudit(tx) {
    try {
      const response = await fetch(
        `${API}/api/transactions/${tx.id}/audit`
      );

      if (!response.ok) {
        throw new Error("Audit not found");
      }

      setAuditModal(await response.json());
    } catch {
      showToast("Unable to load audit trail");
    }
  }

  async function doAction(action) {
    if (!selected) return;

    try {
      if (action === "copy") {
        await navigator.clipboard.writeText(selected.payment_link);
        showToast("Recovery link copied");
      }

      if (action === "whatsapp") {
        const message =
          `Hi ${selected.customer},\n\n` +
          `Your previous payment attempt was unsuccessful.\n\n` +
          `Please retry securely using this Razorpay recovery link:\n` +
          `${selected.payment_link}\n\n` +
          `Transaction: ${selected.id}\n` +
          `Amount: ₹${fmt(selected.amount)}`;

        window.open(
          `https://wa.me/?text=${encodeURIComponent(message)}`,
          "_blank"
        );

        showToast("WhatsApp recovery message opened");
      }

      if (action === "retry") {
        showToast("Intelligent retry scheduled");
      }

      const response = await fetch(
        `${API}/api/transactions/${selected.id}/action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }
      );

      if (!response.ok) {
        throw new Error("Action failed");
      }

      const result = await response.json();

      setSelected((old) =>
        old
          ? {
              ...old,
              status: result.status,
            }
          : old
      );

      await load();

      if (action === "recover") {
        const recoveredTx = {
          ...selected,
          status: result.status,
        };

        setRecoverySuccess(recoveredTx);
        setSelected(null);
        showToast("Payment recovered successfully · Revenue protected");
      }
    } catch {
      showToast("Recovery action failed");
    }
  }

  async function resetDemo() {
    try {
      const response = await fetch(`${API}/api/demo/reset`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Reset failed");
      }

      setSelected(null);
      setCustomerModal(null);
      setAuditModal(null);
      setDemoOpen(false);
      setDemoRunning(false);
      setDemoStage(0);
      setDemoTransaction(null);
      setRecoverySuccess(null);
      setQuery("");
      setStatusFilter("All");
      setFailureFilter("All");
      setAmountFilter("All");
      setChartRange("7D");
      setEvents([]);
      setAuditRows([]);

      await load();

      showToast("Demo reset successfully · Ready for judges");
    } catch {
      showToast("Unable to reset demo");
    }
  }


  async function ask(message = input) {
    if (!message.trim()) return;

    const text = message.trim();

    setChat((old) => [
      ...old,
      {
        role: "user",
        kind: "text",
        text,
      },
    ]);

    setInput("");

    try {
      const response = await fetch(`${API}/api/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error("AI request failed");
      }

      const result = await response.json();

      setChat((old) => [
        ...old,
        {
          role: "assistant",
          kind: result.type,
          text: result.message,
          transaction: result.transaction,
          logs: result.logs,
        },
      ]);
    } catch {
      setChat((old) => [
        ...old,
        {
          role: "assistant",
          kind: "text",
          text: "I could not reach the RevX decision engine. Please check the backend connection.",
        },
      ]);
    }
  }

  async function loadAudits() {
    if (!data?.transactions?.length) return;

    try {
      const results = await Promise.all(
        data.transactions.map(async (tx) => {
          const response = await fetch(
            `${API}/api/transactions/${tx.id}/audit`
          );

          if (!response.ok) return [];

          const result = await response.json();

          return result.logs.map((log) => ({
            ...log,
            transaction: tx,
          }));
        })
      );

      setAuditRows(
        results
          .flat()
          .sort((a, b) => b.id - a.id)
      );
    } catch {
      setAuditRows([]);
    }
  }

  function exportCsv(rows = transactions) {
    const columns = [
      "Transaction ID",
      "Customer",
      "Failure Cause",
      "Amount",
      "AI Strategy",
      "Confidence",
      "Status",
    ];

    const csvRows = rows.map((tx) => [
      tx.id,
      tx.customer,
      tx.failure,
      tx.amount,
      tx.strategy,
      `${tx.confidence}%`,
      tx.status,
    ]);

    const csv = [columns, ...csvRows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "revx-recovery-report.csv";
    anchor.click();

    URL.revokeObjectURL(url);

    showToast("Recovery report exported");
  }

  async function runDemo() {
  if (demoRunning) return;

  const tx = data.transactions.find(
    (item) => item.id === "TXN-8801"
  );

  if (!tx) {
    showToast("Demo transaction TXN-8801 not found");
    return;
  }

  setDemoRunning(true);
  setDemoTransaction(tx);
  setDemoStage(0);
  setDemoOpen(true);

  await sleep(1300);
  setDemoStage(1);

  await sleep(1400);
  setDemoStage(2);

  await sleep(1500);
  setDemoStage(3);

  await sleep(1500);
  setDemoStage(4);

  await sleep(1500);
  setDemoStage(5);

  await sleep(1400);
  setDemoStage(6);

  await sleep(1600);

  setDemoOpen(false);
  setDemoRunning(false);

  await openRecovery(tx);
}


  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading RevX-Agent...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="loading">
        <AlertTriangle size={42} />
        <h2>Unable to load RevX-Agent</h2>
        <p>{error}</p>
        <button
          className="primary"
          onClick={() => {
            setLoading(true);
            load();
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>

          <div>
            <strong>Razorpay</strong>
            <span>RevX-Agent</span>
          </div>
        </div>

        <div className="product-copy">
          Autonomous Revenue Recovery
          <br />
          & Payment Retry Engine
        </div>

        <nav>
          {NAV.map(([Icon, name]) => (
            <button
              key={name}
              className={`nav ${page === name ? "active" : ""}`}
              onClick={() => setPage(name)}
            >
              <Icon size={17} />
              {name}
            </button>
          ))}
        </nav>

        <div className="side-promo">
          <b>
            Turning Failed Payments
            <br />
            into Real Revenue
          </b>

          <p>
            Smarter retries. Happier customers. Higher success rates.
          </p>

          <div className="promo-arrow">↗</div>
        </div>

        <div className="profile">
          <div className="avatar">R</div>

          <div>
            <b>Razorpay Demo</b>
            <small>admin@razorpay.com</small>
          </div>
        </div>

        <button
          className="logout"
          onClick={() => showToast("Demo session is protected")}
        >
          <LogOut size={16} />
          Log out
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search">
            <Search size={17} />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transactions, customers, or reference IDs..."
            />

            <kbd>⌘ K</kbd>
          </div>

          <div className={`webhook ${live ? "on" : ""}`}>
            <span />

            {live
              ? "Live Webhook Listener Active"
              : "Connecting Webhook..."}
          </div>

          <button
            className="notification-button"
            onClick={() =>
              showToast(
                events.length
                  ? `${events.length} recent webhook events`
                  : "No new notifications"
              )
            }
          >
            <Bell size={17} />

            {events.length > 0 && (
              <span className="notification-count">
                {events.length}
              </span>
            )}
          </button>

          <div className="top-icons">
            <div className="mini-avatar">A</div>

            <div>
              <b>Admin</b>
              <small>Razorpay Demo</small>
            </div>
          </div>
        </header>

        {page === "Dashboard" && (
          <Dashboard
            data={data}
            transactions={transactions}
            live={live}
            events={events}
            chartRange={chartRange}
            setChartRange={setChartRange}
            openRecovery={openRecovery}
            openAudit={openAudit}
            exportCsv={exportCsv}
            setPage={setPage}
            runDemo={runDemo}
            demoRunning={demoRunning}
            ask={ask}
            chat={chat}
            input={input}
            setInput={setInput}
          />
        )}

        {page === "Transactions" && (
          <TransactionsPage
            title="All Transactions"
            subtitle="Search, investigate and manage every intercepted payment."
            transactions={transactions}
            openRecovery={openRecovery}
            openAudit={openAudit}
            exportCsv={exportCsv}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            failureFilter={failureFilter}
            setFailureFilter={setFailureFilter}
            amountFilter={amountFilter}
            setAmountFilter={setAmountFilter}
          />
        )}

        {page === "Failed Payments" && (
          <TransactionsPage
            title="Failed Payments"
            subtitle="AI-ranked payment failures requiring recovery action."
            transactions={failedTransactions}
            openRecovery={openRecovery}
            openAudit={openAudit}
            exportCsv={exportCsv}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            failureFilter={failureFilter}
            setFailureFilter={setFailureFilter}
            amountFilter={amountFilter}
            setAmountFilter={setAmountFilter}
          />
        )}

        {page === "Recovery Links" && (
          <RecoveryLinksPage
            transactions={transactions}
            openRecovery={openRecovery}
          />
        )}

        {page === "Analytics" && (
          <AnalyticsPage data={data} />
        )}

        {page === "Reconciliation" && (
          <ReconciliationPage
            transactions={transactions}
            openAudit={openAudit}
          />
        )}

        {page === "AI Assistant" && (
          <AssistantPage
            chat={chat}
            input={input}
            setInput={setInput}
            ask={ask}
          />
        )}

        {page === "Audit Logs" && (
          <AuditPage
            rows={auditRows}
            openAudit={(row) => openAudit(row.transaction)}
          />
        )}

        {page === "Settings" && <SettingsPage live={live} resetDemo={resetDemo} />}
      </main>


      {demoOpen && demoTransaction && (
        <JudgeDemoOverlay
          tx={demoTransaction}
          stage={demoStage}
          close={() => {
            setDemoOpen(false);
            setDemoRunning(false);
          }}
        />
      )}

      {selected && (
        <RecoveryModal
          selected={selected}
          close={() => setSelected(null)}
          doAction={doAction}
          customer={() => setCustomerModal(selected)}
        />
      )}

      {recoverySuccess && (
        <RecoverySuccessModal
          tx={recoverySuccess}
          close={() => setRecoverySuccess(null)}
          viewAudit={async () => {
            const tx = recoverySuccess;
            setRecoverySuccess(null);
            await openAudit(tx);
          }}
        />
      )}

      {customerModal && (
        <CustomerModal
          tx={customerModal}
          close={() => setCustomerModal(null)}
        />
      )}

      {auditModal && (
        <AuditModal
          data={auditModal}
          close={() => setAuditModal(null)}
        />
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function Dashboard({
  data,
  transactions,
  events,
  chartRange,
  setChartRange,
  openRecovery,
  openAudit,
  exportCsv,
  setPage,
  runDemo,
  demoRunning,
  ask,
  chat,
  input,
  setInput,
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">RAZORPAY</div>

          <h1>
            <em>Razorpay</em> <span>RevX-Agent</span>
          </h1>

          <h2>
            Autonomous Revenue Recovery & Payment Retry Engine
          </h2>

          <p>
            Detect failures. Analyse. Retry intelligently. Recover
            revenue.
          </p>

          <div className="hero-actions">
            <button
              className="primary"
              onClick={() => setPage("Failed Payments")}
            >
              View Failed Payments →
            </button>

            <button
              className="secondary"
              onClick={runDemo}
            >
              <Play size={14} />
              {demoRunning ? "Demo Running..." : "Watch Demo"}
            </button>
          </div>
        </div>

        <div className="globe">
          <div className="orb">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>

        <div className="hero-stats">
          <div>
            <b>{data.system.uptime}</b>
            <span>System Uptime</span>
          </div>

          <div>
            <b>{data.system.latency}</b>
            <span>Webhook Latency</span>
          </div>

          <div>
            <b>{data.system.processed}</b>
            <span>Transactions Processed</span>
          </div>
        </div>
      </section>

      <section className="metric-row">
        {data.metrics.map((metric, index) => (
          <div
            className={`metric-card ${metric.tone}`}
            key={metric.label}
          >
            <div className="metric-icon">
              {
                [
                  <ShieldCheck key="shield" />,
                  <CheckCircle2 key="check" />,
                  <Link2 key="link" />,
                  <span className="rupee" key="rupee">
                    ₹
                  </span>,
                ][index]
              }
            </div>

            <div>
              <div className="metric-value">
                {metric.value}

                {metric.change && <span>{metric.change}</span>}
              </div>

              <b>{metric.label}</b>
              <small>{metric.sub}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="content-grid">
        <div className="left-stack">
          <div className="charts-grid">
            <div className="panel chart-panel">
              <div className="panel-head">
                <div>
                  <h3>
                    Transaction Volume vs. Recovered Volume
                  </h3>

                  <small>Daily recovery performance</small>
                </div>

                <div className="seg">
                  {["7D", "30D", "90D", "1Y"].map((range) => (
                    <button
                      key={range}
                      className={
                        chartRange === range ? "segment-active" : ""
                      }
                      onClick={() => setChartRange(range)}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.chart}>
                    <CartesianGrid
                      stroke="#18304b"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="day"
                      stroke="#7890ad"
                    />

                    <YAxis stroke="#7890ad" />

                    <Tooltip
                      contentStyle={{
                        background: "#0b1b30",
                        border: "1px solid #25486f",
                        borderRadius: 12,
                      }}
                    />

                    <Legend />

                    <Bar
                      dataKey="transactions"
                      name="Total Transactions"
                      fill="#1677ff"
                      radius={[3, 3, 0, 0]}
                    />

                    <Bar
                      dataKey="recovered"
                      name="Recovered Volume"
                      fill="#20c997"
                      radius={[3, 3, 0, 0]}
                    />

                    <Line
                      dataKey="recovered"
                      name="Recovery Trend"
                      stroke="#dbeafe"
                      strokeWidth={2.5}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <FailureChart data={data} />
          </div>

          <TransactionTable
            transactions={transactions}
            openRecovery={openRecovery}
            openAudit={openAudit}
            exportCsv={exportCsv}
          />

          <div className="bottom-cards">
            <InfoCard
              icon={<Zap />}
              title="Real-time Webhook Processing"
              description="Live event ingestion from Razorpay"
              value={`${data.system.events_per_min} events/min`}
            />

            <InfoCard
              icon={<Bot />}
              title="AI-Powered Decision Engine"
              description="Smart retry strategies & link generation"
              value={`${data.system.strategy_accuracy} strategy accuracy`}
            />

            <InfoCard
              icon={<Activity />}
              title="Revenue Impact"
              description="Recovered ₹24.8M this month"
              value="+67% vs. previous month"
            />

            <InfoCard
              icon={<Users />}
              title="Customer Experience"
              description="Faster resolutions, higher success"
              value={`${data.system.recovery_rate} recovery rate`}
            />
          </div>
        </div>

        <AssistantPanel
          chat={chat}
          input={input}
          setInput={setInput}
          ask={ask}
          events={events}
        />
      </section>
    </>
  );
}

function FailureChart({ data }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>Failure Distribution</h3>
          <small>Current failed payment breakdown</small>
        </div>

        <button className="filter-btn">This month</button>
      </div>

      <div className="pie-area">
        <div className="pie">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data.failures}
                dataKey="value"
                innerRadius={62}
                outerRadius={93}
              >
                {data.failures.map((failure) => (
                  <Cell
                    key={failure.name}
                    fill={failure.color}
                  />
                ))}
              </Pie>

              <Tooltip
                contentStyle={{
                  background: "#0b1b30",
                  border: "1px solid #25486f",
                  borderRadius: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="pie-center">
            <b>356</b>
            <span>Failed Payments</span>
          </div>
        </div>

        <div className="legend-list">
          {data.failures.map((failure) => (
            <div key={failure.name}>
              <span
                className="dot"
                style={{
                  background: failure.color,
                }}
              />

              <span>{failure.name}</span>
              <b>{failure.value}%</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionTable({
  transactions,
  openRecovery,
  openAudit,
  exportCsv,
}) {
  return (
    <div className="panel table-panel">
      <div className="panel-head">
        <div>
          <h3>
            Priority Cases{" "}
            <span className="count">
              {transactions.length}
            </span>
          </h3>

          <small>
            High-impact failed payments requiring attention
          </small>
        </div>

        <button
          className="toolbar-button"
          onClick={() => exportCsv(transactions)}
        >
          <Download size={13} />
          Export CSV
        </button>
      </div>

      <TransactionRows
        transactions={transactions}
        openRecovery={openRecovery}
        openAudit={openAudit}
      />
    </div>
  );
}

function TransactionsPage({
  title,
  subtitle,
  transactions,
  openRecovery,
  openAudit,
  exportCsv,
  statusFilter,
  setStatusFilter,
  failureFilter,
  setFailureFilter,
  amountFilter,
  setAmountFilter,
}) {
  return (
    <div className="page-view">
      <div className="page-title-row">
        <div>
          <span className="page-kicker">
            REVX OPERATIONS
          </span>

          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <button
          className="primary"
          onClick={() => exportCsv(transactions)}
        >
          <Download size={15} />
          Export Report
        </button>
      </div>

      <div className="filter-strip">
        <select
          value={failureFilter}
          onChange={(e) => setFailureFilter(e.target.value)}
        >
          <option>All</option>
          <option>Issuer Bank Outage</option>
          <option>Card Decline</option>
          <option>Network Timeout</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>High Priority</option>
          <option>Critical</option>
          <option>Recovery Ready</option>
          <option>Monitoring</option>
          <option>Link Sent</option>
          <option>Retry Scheduled</option>
        </select>

        <select
          value={amountFilter}
          onChange={(e) => setAmountFilter(e.target.value)}
        >
          <option>All</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
      </div>

      <div className="panel page-panel">
        <TransactionRows
          transactions={transactions}
          openRecovery={openRecovery}
          openAudit={openAudit}
        />
      </div>
    </div>
  );
}

function TransactionRows({
  transactions,
  openRecovery,
  openAudit,
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Customer</th>
            <th>Failure Cause</th>
            <th>Amount</th>
            <th>AI Strategy</th>
            <th>Confidence</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>
                <b>{tx.id}</b>
              </td>

              <td>{tx.customer}</td>

              <td className="danger-text">
                {tx.failure}
              </td>

              <td>₹{fmt(tx.amount)}</td>

              <td>{tx.strategy}</td>

              <td>
                <b>{tx.confidence}%</b>
              </td>

              <td>
                <span
                  className={`status ${tx.status
                    .toLowerCase()
                    .replaceAll(" ", "-")}`}
                >
                  {tx.status}
                </span>
              </td>

              <td>
                <div className="row-actions">
                  <button
                    className="view-btn"
                    onClick={() => openRecovery(tx)}
                  >
                    Take Action
                  </button>

                  <button
                    className="icon-action"
                    onClick={() => openAudit(tx)}
                  >
                    Audit
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {transactions.length === 0 && (
            <tr>
              <td
                colSpan="8"
                className="empty-row"
              >
                No transactions match your current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RecoveryLinksPage({ transactions, openRecovery }) {
  return (
    <div className="page-view">
      <div className="page-title-row">
        <div>
          <span className="page-kicker">
            CUSTOMER RECOVERY
          </span>

          <h1>Recovery Links</h1>

          <p>
            Secure Razorpay payment links generated by the
            autonomous recovery engine.
          </p>
        </div>
      </div>

      <div className="recovery-grid">
        {transactions.map((tx) => (
          <div className="recovery-card panel" key={tx.id}>
            <div className="recovery-icon">
              <Link2 />
            </div>

            <div className="recovery-card-head">
              <div>
                <small>{tx.id}</small>
                <h3>{tx.customer}</h3>
              </div>

              <span
                className={`status ${tx.status
                  .toLowerCase()
                  .replaceAll(" ", "-")}`}
              >
                {tx.status}
              </span>
            </div>

            <strong>₹{fmt(tx.amount)}</strong>

            <p>{tx.strategy}</p>

            <div className="masked-link">
              {tx.payment_link}
            </div>

            <button
              className="primary full-button"
              onClick={() => openRecovery(tx)}
            >
              Open Recovery Action
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsPage({ data }) {
  const rows = data?.transactions || [];
  const recoveredRows = rows.filter((tx) => tx.status === "Recovered");

  const totalAtRisk = rows.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const recoveredRevenue = recoveredRows.reduce(
    (sum, tx) => sum + Number(tx.amount || 0),
    0
  );
  const expectedRecoverable = rows.reduce(
    (sum, tx) => sum + getExpectedRecovery(tx),
    0
  );
  const averageConfidence = rows.length
    ? Math.round(
        rows.reduce((sum, tx) => sum + Number(tx.confidence || 0), 0) /
          rows.length
      )
    : 0;
  const liveRecoveryRate = rows.length
    ? Math.round((recoveredRows.length / rows.length) * 100)
    : 0;

  const analyticsCards = [
    {
      label: "Revenue at Risk",
      value: `₹${fmt(totalAtRisk)}`,
      sub: "Value currently represented by intercepted failures",
      tone: "blue",
    },
    {
      label: "Recovered in Demo",
      value: `₹${fmt(recoveredRevenue)}`,
      sub: `${recoveredRows.length} transaction${
        recoveredRows.length === 1 ? "" : "s"
      } successfully recovered`,
      tone: "green",
    },
    {
      label: "Expected Recoverable",
      value: `₹${fmt(expectedRecoverable)}`,
      sub: "AI-weighted recoverable value across active cases",
      tone: "amber",
    },
    {
      label: "AI Confidence",
      value: `${averageConfidence}%`,
      sub: `Live recovery completion: ${liveRecoveryRate}%`,
      tone: "indigo",
    },
  ];

  return (
    <div className="page-view">
      <div className="page-title-row">
        <div>
          <span className="page-kicker">PERFORMANCE INTELLIGENCE</span>

          <h1>Revenue Recovery Analytics</h1>

          <p>
            Live recovery impact, expected recoverable value and AI decision
            performance.
          </p>
        </div>
      </div>

      <section className="metric-row analytics-metrics">
        {analyticsCards.map((metric) => (
          <div
            className={`metric-card ${metric.tone}`}
            key={metric.label}
          >
            <div>
              <div className="metric-value">{metric.value}</div>
              <b>{metric.label}</b>
              <small>{metric.sub}</small>
            </div>
          </div>
        ))}
      </section>

      <div className="charts-grid analytics-grid">
        <div className="panel analytics-chart">
          <div className="panel-head">
            <div>
              <h3>Recovery Performance</h3>
              <small>Transaction volume against recovered volume</small>
            </div>
          </div>

          <div className="large-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.chart}>
                <CartesianGrid
                  stroke="#18304b"
                  vertical={false}
                />

                <XAxis
                  dataKey="day"
                  stroke="#7890ad"
                />

                <YAxis stroke="#7890ad" />

                <Tooltip
                  contentStyle={{
                    background: "#0b1b30",
                    border: "1px solid #25486f",
                  }}
                />

                <Bar
                  dataKey="transactions"
                  fill="#1677ff"
                />

                <Bar
                  dataKey="recovered"
                  fill="#20c997"
                />

                <Line
                  type="monotone"
                  dataKey="recovered"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <FailureChart data={data} />
      </div>

      <div className="panel page-panel">
        <div className="panel-head">
          <div>
            <h3>AI Recovery Value Intelligence</h3>
            <small>
              Expected value is calculated from each transaction's recovery
              probability.
            </small>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Amount</th>
                <th>Recovery Probability</th>
                <th>Expected Recoverable</th>
                <th>AI Confidence</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((tx) => (
                <tr key={`analytics-${tx.id}`}>
                  <td>
                    <b>{tx.id}</b>
                  </td>
                  <td>₹{fmt(tx.amount)}</td>
                  <td>
                    <b>{getRecoveryProbability(tx)}%</b>
                  </td>
                  <td className="green">
                    <b>₹{fmt(getExpectedRecovery(tx))}</b>
                  </td>
                  <td>{tx.confidence}%</td>
                  <td>
                    <span
                      className={`status ${tx.status
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                    >
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReconciliationPage({
  transactions,
  openAudit,
}) {
  return (
    <div className="page-view">
      <div className="page-title-row">
        <div>
          <span className="page-kicker">
            PAYMENT TRACE
          </span>

          <h1>Reconciliation Engine</h1>

          <p>
            Compare payment failures, recovery decisions and
            settlement states.
          </p>
        </div>
      </div>

      <div className="reconcile-list">
        {transactions.map((tx) => (
          <div
            className="panel reconcile-card"
            key={tx.id}
          >
            <div className="reconcile-step success">
              <CheckCircle2 />
              <span>
                <b>Payment Received</b>
                <small>{tx.id}</small>
              </span>
            </div>

            <div className="flow-arrow">→</div>

            <div className="reconcile-step failed">
              <AlertTriangle />
              <span>
                <b>{tx.failure}</b>
                <small>{tx.error_code}</small>
              </span>
            </div>

            <div className="flow-arrow">→</div>

            <div className="reconcile-step ai">
              <Bot />
              <span>
                <b>{tx.strategy}</b>
                <small>
                  Confidence {tx.confidence}%
                </small>
              </span>
            </div>

            <div className="flow-arrow">→</div>

            <div className="reconcile-step">
              <Link2 />
              <span>
                <b>{tx.status}</b>
                <small>{tx.retry_window}</small>
              </span>
            </div>

            <button
              className="view-btn"
              onClick={() => openAudit(tx)}
            >
              View Decision Trace
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantPage({
  chat,
  input,
  setInput,
  ask,
}) {
  return (
    <div className="page-view assistant-page">
      <div className="page-title-row">
        <div>
          <span className="page-kicker">
            REVX INTELLIGENCE
          </span>

          <h1>AI Recovery Copilot</h1>

          <p>
            Explain failures, investigate decisions and surface
            recovery opportunities.
          </p>
        </div>
      </div>

      <div className="panel assistant-workspace">
        <AssistantPanel
          chat={chat}
          input={input}
          setInput={setInput}
          ask={ask}
          events={[]}
          standalone
        />
      </div>
    </div>
  );
}

function AssistantPanel({
  chat,
  input,
  setInput,
  ask,
  events,
  standalone = false,
}) {
  const prompts = [
    "Show bank outages",
    "Explain TXN-8801 failure",
    "Generate summary report",
    "Find high-value recovery opportunities",
  ];

  return (
    <aside
      className={
        standalone
          ? "assistant-inner"
          : "copilot panel"
      }
    >
      <div className="copilot-head">
        <div>
          <Sparkles size={18} />

          <b>AI Assistant</b>

          <span>Beta</span>
        </div>

        <span className="online">● Online</span>
      </div>

      <div className="quick">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => ask(prompt)}
          >
            ◉ {prompt}
            <span>→</span>
          </button>
        ))}
      </div>

      <div className="chat">
        {chat.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role}`}
          >
            {message.text}

            {message.kind === "audit" &&
              message.transaction && (
                <div className="audit-card">
                  <div className="audit-title">
                    {message.transaction.id} · Decision Trace
                  </div>

                  <dl>
                    <dt>Failure Cause</dt>
                    <dd>
                      {message.transaction.failure}
                    </dd>

                    <dt>Amount</dt>
                    <dd>
                      ₹{fmt(message.transaction.amount)}
                    </dd>

                    <dt>Error Code</dt>
                    <dd>
                      {message.transaction.error_code}
                    </dd>

                    <dt>AI Analysis</dt>
                    <dd>
                      {message.transaction.analysis}
                    </dd>

                    <dt>Strategy</dt>
                    <dd>
                      {message.transaction.strategy}
                    </dd>

                    <dt>Retry Window</dt>
                    <dd>
                      {message.transaction.retry_window}
                    </dd>

                    <dt>Confidence</dt>
                    <dd className="green">
                      {message.transaction.confidence}%
                    </dd>
                  </dl>

                  {message.logs?.length > 0 && (
                    <div className="mini-audit-list">
                      {message.logs.map((log) => (
                        <div key={log.id}>
                          <b>{log.event}</b>
                          <small>{log.detail}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && ask()
          }
          placeholder="Ask anything about transactions..."
        />

        <button onClick={() => ask()}>
          <Send size={16} />
        </button>
      </div>

      {events.length > 0 && (
        <div className="event-stream">
          <b>Live Webhook Stream</b>

          {events.slice(0, 4).map((event, index) => (
            <small key={index}>
              <span>●</span>
              {event.type} · {event.txn}
            </small>
          ))}
        </div>
      )}
    </aside>
  );
}

function AuditPage({ rows, openAudit }) {
  return (
    <div className="page-view">
      <div className="page-title-row">
        <div>
          <span className="page-kicker">
            TRUST & TRACEABILITY
          </span>

          <h1>Audit Logs</h1>

          <p>
            Immutable decision history for every recovery action.
          </p>
        </div>
      </div>

      <div className="panel page-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Event</th>
                <th>Detail</th>
                <th>Trace</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={`${row.transaction.id}-${row.id}`}>
                  <td>
                    <b>{row.transaction.id}</b>
                  </td>

                  <td>
                    {new Date(row.ts).toLocaleString()}
                  </td>

                  <td>{row.actor}</td>

                  <td>{row.event}</td>

                  <td>{row.detail}</td>

                  <td>
                    <button
                      className="view-btn"
                      onClick={() => openAudit(row)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ live, resetDemo }) {
  return (
    <div className="page-view">
      <div className="page-title-row">
        <div>
          <span className="page-kicker">
            PLATFORM CONTROL
          </span>

          <h1>System Settings</h1>

          <p>
            Runtime and demo configuration for RevX-Agent.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <SettingCard
          title="Webhook Receiver"
          description="Razorpay event stream connectivity."
          value={live ? "ACTIVE" : "DISCONNECTED"}
          positive={live}
        />

        <SettingCard
          title="AI Decision Engine"
          description="Autonomous payment recovery strategy."
          value="ACTIVE"
          positive
        />

        <SettingCard
          title="Recovery Mode"
          description="Demo-safe payment link generation."
          value="SANDBOX"
          positive
        />

        <SettingCard
          title="Audit Logging"
          description="Decision trace and recovery action logging."
          value="ENABLED"
          positive
        />

        <div className="panel setting-card reset-demo-card">
          <div>
            <h3>Judge Demo Reset</h3>
            <p>
              Restore all demo transactions, statuses and audit history to the
              original hackathon-ready state.
            </p>
          </div>

          <button className="primary" onClick={resetDemo}>
            <RefreshCw size={16} />
            Reset Demo
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingCard({
  title,
  description,
  value,
  positive,
}) {
  return (
    <div className="panel setting-card">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <span
        className={
          positive ? "setting-positive" : "setting-negative"
        }
      >
        {value}
      </span>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  description,
  value,
}) {
  return (
    <div>
      {icon}

      <span>
        <b>{title}</b>
        <small>{description}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function RecoveryModal({
  selected,
  close,
  doAction,
  customer,
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={close}
    >
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="close"
          onClick={close}
        >
          <X />
        </button>

        <span className="modal-kicker">
          REVX RECOVERY ACTION
        </span>

        <h3>Recovery Payment Link</h3>

        <div className="modal-meta">
          <div>
            <span>Transaction ID</span>
            <b>{selected.id}</b>
          </div>

          <div>
            <span>Customer</span>
            <b>{selected.customer}</b>
          </div>

          <div>
            <span>Amount</span>
            <b>₹{fmt(selected.amount)}</b>
          </div>
        </div>

        <div className="strategy-box">
          <small>AI Recovery Strategy</small>

          <b>{selected.strategy}</b>

          <span>
            Confidence {selected.confidence}% · Retry{" "}
            {selected.retry_window}
          </span>
        </div>

        <label>Recovery Link (Razorpay)</label>

        <div className="link-field">
          <input
            readOnly
            value={selected.payment_link}
          />

          <button onClick={() => doAction("copy")}>
            <ClipboardCopy size={17} />
            Copy Link
          </button>
        </div>

        <button
          className="retry-button"
          onClick={() => doAction("retry")}
        >
          <RefreshCw size={17} />
          Schedule Intelligent Retry
        </button>

        <button
          className="whatsapp"
          onClick={() => doAction("whatsapp")}
        >
          <MessageCircle size={18} />
          Send via WhatsApp
        </button>

        <button
          className="recover-success-button"
          onClick={() => doAction("recover")}
        >
          <CheckCircle2 size={18} />
          Simulate Successful Recovery
        </button>

        <button
          className="customer"
          onClick={customer}
        >
          View Customer Details →
        </button>
      </div>
    </div>
  );
}


function RecoverySuccessModal({ tx, close, viewAudit }) {
  const probability = getRecoveryProbability(tx);

  const recoveryTime =
    tx.id === "TXN-8801"
      ? "12m 18s"
      : tx.retry_window === "Immediate"
      ? "38s"
      : tx.retry_window;

  const backdropStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 1200,
    background: "rgba(2, 10, 23, 0.88)",
    backdropFilter: "blur(10px)",
    display: "grid",
    placeItems: "center",
    padding: "24px",
  };

  const cardStyle = {
    width: "min(720px, 96vw)",
    maxHeight: "92vh",
    overflowY: "auto",
    background:
      "linear-gradient(180deg, rgba(10, 27, 48, 0.98), rgba(5, 17, 31, 0.99))",
    border: "1px solid rgba(52, 211, 153, 0.36)",
    borderRadius: "24px",
    boxShadow:
      "0 30px 90px rgba(0, 0, 0, 0.55), 0 0 60px rgba(16, 185, 129, 0.10)",
    padding: "32px",
    color: "#f8fbff",
  };

  const successIconStyle = {
    width: "72px",
    height: "72px",
    borderRadius: "999px",
    margin: "0 auto 18px",
    display: "grid",
    placeItems: "center",
    background: "rgba(16, 185, 129, 0.14)",
    border: "1px solid rgba(52, 211, 153, 0.38)",
    boxShadow: "0 0 36px rgba(16, 185, 129, 0.16)",
  };

  const metricGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "24px",
  };

  const metricStyle = {
    padding: "15px 16px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.13)",
  };

  const actionRowStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginTop: "24px",
  };

  return (
    <div
      style={backdropStyle}
      onMouseDown={close}
    >
      <div
        style={cardStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center" }}>
          <div style={successIconStyle}>
            <CheckCircle2 size={38} />
          </div>

          <span
            style={{
              display: "inline-block",
              fontSize: "11px",
              letterSpacing: "0.16em",
              fontWeight: 800,
              color: "#6ee7b7",
              marginBottom: "8px",
            }}
          >
            REVX AUTONOMOUS RECOVERY COMPLETE
          </span>

          <h2
            style={{
              margin: "0 0 6px",
              fontSize: "30px",
              letterSpacing: "-0.02em",
            }}
          >
            PAYMENT RECOVERED
          </h2>

          <div
            style={{
              marginTop: "16px",
              fontSize: "38px",
              lineHeight: 1,
              fontWeight: 900,
              color: "#ffffff",
            }}
          >
            ₹{fmt(tx.amount)}
          </div>

          <div
            style={{
              marginTop: "8px",
              color: "#6ee7b7",
              fontWeight: 800,
              letterSpacing: "0.08em",
              fontSize: "12px",
            }}
          >
            REVENUE PROTECTED
          </div>
        </div>

        <div style={metricGridStyle}>
          <div style={metricStyle}>
            <small style={{ color: "#8ea5bf" }}>Transaction</small>
            <div style={{ marginTop: "5px", fontWeight: 800 }}>{tx.id}</div>
          </div>

          <div style={metricStyle}>
            <small style={{ color: "#8ea5bf" }}>Customer</small>
            <div style={{ marginTop: "5px", fontWeight: 800 }}>
              {tx.customer}
            </div>
          </div>

          <div style={metricStyle}>
            <small style={{ color: "#8ea5bf" }}>AI Confidence</small>
            <div
              style={{
                marginTop: "5px",
                fontWeight: 900,
                color: "#6ee7b7",
              }}
            >
              {tx.confidence}%
            </div>
          </div>

          <div style={metricStyle}>
            <small style={{ color: "#8ea5bf" }}>Recovery Probability</small>
            <div
              style={{
                marginTop: "5px",
                fontWeight: 900,
                color: "#93c5fd",
              }}
            >
              {probability}%
            </div>
          </div>

          <div style={metricStyle}>
            <small style={{ color: "#8ea5bf" }}>Recovery Strategy</small>
            <div style={{ marginTop: "5px", fontWeight: 800 }}>
              {tx.strategy}
            </div>
          </div>

          <div style={metricStyle}>
            <small style={{ color: "#8ea5bf" }}>Recovery Time</small>
            <div style={{ marginTop: "5px", fontWeight: 800 }}>
              {recoveryTime}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "18px",
            padding: "16px 18px",
            borderRadius: "16px",
            background: "rgba(16, 185, 129, 0.07)",
            border: "1px solid rgba(52, 211, 153, 0.20)",
          }}
        >
          <div style={{ display: "grid", gap: "10px", fontSize: "14px" }}>
            <div>✓ Payment successfully recovered</div>
            <div>✓ Audit trail recorded by RevX Recovery Engine</div>
            <div>✓ Manual intervention: 0</div>
          </div>
        </div>

        <div style={actionRowStyle}>
          <button
            className="secondary"
            onClick={viewAudit}
            style={{ minHeight: "46px" }}
          >
            <FileText size={16} />
            View Audit Trail
          </button>

          <button
            className="primary"
            onClick={close}
            style={{ minHeight: "46px" }}
          >
            <CheckCircle2 size={16} />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerModal({ tx, close }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={close}
    >
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="close"
          onClick={close}
        >
          <X />
        </button>

        <span className="modal-kicker">
          CUSTOMER RECOVERY PROFILE
        </span>

        <h3>{tx.customer}</h3>

        <div className="customer-info-grid">
          <div>
            <span>Transaction</span>
            <b>{tx.id}</b>
          </div>

          <div>
            <span>Payment Value</span>
            <b>₹{fmt(tx.amount)}</b>
          </div>

          <div>
            <span>Failure Cause</span>
            <b>{tx.failure}</b>
          </div>

          <div>
            <span>Recommended Path</span>
            <b>{tx.strategy}</b>
          </div>
        </div>

        <div className="analysis-box">
          <small>AI Analysis</small>
          <p>{tx.analysis}</p>
        </div>
      </div>
    </div>
  );
}

function AuditModal({ data, close }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={close}
    >
      <div
        className="modal audit-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="close"
          onClick={close}
        >
          <X />
        </button>

        <span className="modal-kicker">
          DECISION ENGINE TRACE
        </span>

        <h3>{data.transaction.id}</h3>

        <div className="analysis-box">
          <small>AI Decision</small>
          <p>{data.transaction.analysis}</p>
        </div>

        <div className="audit-timeline">
          {data.logs.map((log) => (
            <div
              className="audit-event"
              key={log.id}
            >
              <span className="audit-dot" />

              <div>
                <b>{log.event}</b>

                <small>
                  {new Date(log.ts).toLocaleString()} ·{" "}
                  {log.actor}
                </small>

                <p>{log.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JudgeDemoOverlay({ tx, stage, close }) {
  const probability = getRecoveryProbability(tx);
  const expectedRecovery = getExpectedRecovery(tx);

  const steps = [
    {
      title: "Payment Intercepted",
      description: `${tx.id} · ₹${fmt(tx.amount)}`,
    },
    {
      title: "Failure Detected",
      description: tx.failure,
    },
    {
      title: "Root Cause Identified",
      description: tx.error_code,
    },
    {
      title: "Recovery Probability",
      description: `${probability}% probability of successful recovery`,
    },
    {
      title: "AI Strategy Selected",
      description: `${tx.strategy} · ${tx.confidence}% confidence`,
    },
    {
      title: "Retry Window Calculated",
      description: `Optimal retry window: ${tx.retry_window}`,
    },
    {
      title: "Recovery Link Generated",
      description: "Secure Razorpay recovery path ready",
    },
  ];

  return (
    <div className="judge-demo-backdrop">
      <div className="judge-demo">
        <button className="judge-close" onClick={close}>
          <X size={20} />
        </button>

        <div className="judge-heading">
          <span>REVX AUTONOMOUS DECISION ENGINE</span>

          <h2>
            Recovering <strong>₹{fmt(tx.amount)}</strong>
          </h2>

          <p>
            Watch RevX-Agent diagnose the failure and select the optimal
            recovery strategy in real time.
          </p>
        </div>

        <div className="judge-transaction">
          <div>
            <small>TRANSACTION</small>
            <b>{tx.id}</b>
          </div>

          <div>
            <small>CUSTOMER</small>
            <b>{tx.customer}</b>
          </div>

          <div>
            <small>VALUE</small>
            <b>₹{fmt(tx.amount)}</b>
          </div>

          <div>
            <small>STATUS</small>
            <b className="judge-danger">FAILED</b>
          </div>
        </div>

        <div className="judge-layout">
          <div className="judge-timeline">
            {steps.map((item, index) => {
              const complete = index < stage;
              const current = index === stage;

              return (
                <div
                  key={item.title}
                  className={`judge-step ${complete ? "complete" : ""} ${
                    current ? "current" : ""
                  }`}
                >
                  <div className="judge-step-icon">
                    {complete ? "✓" : index + 1}
                  </div>

                  <div>
                    <b>{item.title}</b>
                    <small>{item.description}</small>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="judge-intelligence">
            <span className="judge-ai-label">
              AI DECISION INTELLIGENCE
            </span>

            <div className="judge-score">
              <div>
                <small>Recovery Probability</small>
                <strong>{probability}%</strong>
              </div>

              <div>
                <small>AI Confidence</small>
                <strong>{tx.confidence}%</strong>
              </div>
            </div>

            <div className="judge-value">
              <small>EXPECTED RECOVERABLE VALUE</small>

              <strong>₹{fmt(expectedRecovery)}</strong>

              <span>
                from ₹{fmt(tx.amount)} at {probability}% recovery probability
              </span>
            </div>

            <div className="judge-analysis">
              <small>ROOT CAUSE ANALYSIS</small>
              <p>{tx.analysis}</p>
            </div>

            <div className="judge-strategy">
              <small>SELECTED RECOVERY STRATEGY</small>
              <b>{tx.strategy}</b>
              <span>Retry window: {tx.retry_window}</span>
            </div>
          </div>
        </div>

        <div className="judge-processing">
          <span />
          {stage < steps.length - 1
            ? "RevX-Agent is analyzing the transaction..."
            : "Recovery strategy ready — preparing customer recovery action"}
        </div>
      </div>
    </div>
  );
}
