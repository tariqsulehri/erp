'use client';

import { useState, useRef, useEffect } from 'react';
import {
  IconBuildingBank,
  IconChartBar,
  IconPackage,
  IconUsersGroup,
  IconShieldCheck,
  IconScale,
  IconSparkles,
  IconSend,
  IconRefresh,
  IconAlertTriangle,
  IconAlertCircle,
  IconCheck,
  IconBulb,
  IconTrash,
  IconArrowRight,
  IconWallet,
  IconBuildingStore,
} from '@tabler/icons-react';
import {
  useExecutiveBriefing,
  useExecutiveAiQueryMutation,
  type ExecutiveAiQueryResponse,
  type MetricStatus,
} from '@/lib/api/executive-ai';
import { Button } from '@/components/ui/Button';
import { StatTile, type StatTone } from '@/components/ui/StatTile';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/LoadingSpinner';

interface ChatTurn {
  id: string;
  sender: 'user' | 'ai';
  text?: string;
  response?: ExecutiveAiQueryResponse;
  timestamp: string;
}

const STRATEGIC_PROMPTS = [
  {
    category: 'Treasury & Liquidity',
    icon: IconWallet,
    prompt: 'What is our current cash and bank balance breakdown?',
  },
  {
    category: 'Debtors & AR',
    icon: IconUsersGroup,
    prompt: 'Which customers owe us the most money and what is overdue?',
  },
  {
    category: 'Payables & AP',
    icon: IconBuildingStore,
    prompt: 'What are our upcoming supplier payables and obligations?',
  },
  {
    category: 'Profit & Margins',
    icon: IconChartBar,
    prompt: 'What are our top revenue and expense drivers this year?',
  },
  {
    category: 'Stock & Inventory',
    icon: IconPackage,
    prompt: 'Which inventory items are completely out of stock or low?',
  },
  {
    category: 'Governance & Risk',
    icon: IconShieldCheck,
    prompt: 'What are the unposted draft vouchers and maker-checker status?',
  },
  {
    category: 'Strategic Actions',
    icon: IconBulb,
    prompt: 'Give me executive strategic recommendations to improve liquidity.',
  },
];

export function ExecutiveAiWorkspace({ isDrawer = false }: { isDrawer?: boolean }) {
  const { data: briefing, isLoading: isBriefingLoading, refetch, isFetching } = useExecutiveBriefing();
  const queryMutation = useExecutiveAiQueryMutation();

  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const streamEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (typeof streamEndRef.current?.scrollIntoView === 'function') {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (history.length > 0) {
      scrollToBottom();
    }
  }, [history]);

  const handleSendQuery = (textToSend?: string) => {
    const q = (textToSend || question).trim();
    if (!q || queryMutation.isPending) return;

    const userTurn: ChatTurn = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setHistory(prev => [...prev, userTurn]);
    if (!textToSend) setQuestion('');

    queryMutation.mutate(
      { question: q },
      {
        onSuccess: data => {
          const aiTurn: ChatTurn = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            response: data,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setHistory(prev => [...prev, aiTurn]);
        },
        onError: err => {
          const errorTurn: ChatTurn = {
            id: `ai-err-${Date.now()}`,
            sender: 'ai',
            text: `Unable to process executive query: ${err.message}. Please check connection or try another inquiry.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setHistory(prev => [...prev, errorTurn]);
        },
      }
    );
  };

  const clearChat = () => {
    setHistory([]);
  };

  const statusTone = (status?: MetricStatus): StatTone => {
    switch (status) {
      case 'optimal':
        return 'teal';
      case 'warning':
        return 'amber';
      case 'critical':
        return 'rose';
      default:
        return 'blue';
    }
  };

  const statusBadgeVariant = (status?: MetricStatus): 'success' | 'warning' | 'danger' | 'neutral' => {
    switch (status) {
      case 'optimal':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="executive-ai-workspace" style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--color-surface)',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgb(var(--accent-soft))',
              color: 'var(--color-primary)',
            }}
          >
            <IconSparkles size={22} stroke={1.8} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: isDrawer ? 16 : 18, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                Executive AI Intelligence
              </h1>
              {briefing && (
                <Badge variant={statusBadgeVariant(briefing.healthStatus)}>
                  Health Index {briefing.healthScore}/100 · {briefing.healthStatus.toUpperCase()}
                </Badge>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
              Real-time CEO briefing & multi-angle ledger analysis directly from PostgreSQL database.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {history.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<IconTrash size={14} />}
              onClick={clearChat}
              title="Clear current inquiry history"
            >
              Clear
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<IconRefresh size={14} className={isFetching ? 'spin' : ''} />}
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh database metrics"
          >
            {isFetching ? 'Syncing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* 2. Executive KPI Pulse Bar */}
      {isBriefingLoading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spinner size="md" />
        </div>
      ) : briefing ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isDrawer
              ? 'repeat(auto-fit, minmax(180px, 1fr))'
              : 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 10,
          }}
        >
          <StatTile
            label={briefing.kpis.cashAndBank.label}
            value={briefing.kpis.cashAndBank.value}
            icon={<IconBuildingBank size={16} />}
            tone={statusTone(briefing.kpis.cashAndBank.status)}
            help="Liquid balances across all verified bank accounts and petty cash reserves."
            detail={briefing.kpis.cashAndBank.hint}
            onClick={() => handleSendQuery('What is our current cash and bank balance breakdown?')}
          />
          <StatTile
            label={briefing.kpis.netProfitYtd.label}
            value={briefing.kpis.netProfitYtd.value}
            icon={<IconScale size={16} />}
            tone={statusTone(briefing.kpis.netProfitYtd.status)}
            help="Net profit computed as Revenue minus Cost of Goods Sold and Operating Expenses."
            detail={`Gross Margin: ${briefing.kpis.grossMargin.value}`}
            onClick={() => handleSendQuery('What are our top revenue and expense drivers this year?')}
          />
          <StatTile
            label={briefing.kpis.receivables.label}
            value={briefing.kpis.receivables.value}
            icon={<IconUsersGroup size={16} />}
            tone={statusTone(briefing.kpis.receivables.status)}
            help="Total outstanding debtor balances with overdue aging."
            detail={`${briefing.kpis.receivables.overdueRatio} Overdue (>30d)`}
            onClick={() => handleSendQuery('Which customers owe us the most money and what is overdue?')}
          />
          <StatTile
            label={briefing.kpis.stockValuation.label}
            value={briefing.kpis.stockValuation.value}
            icon={<IconPackage size={16} />}
            tone={statusTone(briefing.kpis.stockValuation.status)}
            help="Total inventory valuation across all active branches and warehouses."
            detail={
              briefing.kpis.stockValuation.zeroStockCount > 0
                ? `${briefing.kpis.stockValuation.zeroStockCount} Out-of-Stock SKUs`
                : `${briefing.kpis.stockValuation.lowStockCount} Near Safety Stock`
            }
            onClick={() => handleSendQuery('Which inventory items are completely out of stock or low?')}
          />
          <StatTile
            label="Maker-Checker Compliance"
            value={`${briefing.kpis.internalControl.dualControlRate}%`}
            icon={<IconShieldCheck size={16} />}
            tone={briefing.kpis.internalControl.dualControlRate >= 80 ? 'teal' : 'amber'}
            help="Percentage of posted accounting vouchers that underwent 4-Eyes dual control authorization."
            detail={`${briefing.kpis.internalControl.unpostedVouchersCount} Unposted Drafts (${briefing.kpis.internalControl.unpostedVouchersTotal})`}
            onClick={() => handleSendQuery('What are the unposted draft vouchers and maker-checker status?')}
          />
        </div>
      ) : null}

      {/* 3. Critical Alerts Banner (if any warning or critical exists) */}
      {briefing && briefing.criticalAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {briefing.criticalAlerts.map(alert => (
            <div
              key={alert.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 6,
                background:
                  alert.level === 'critical'
                    ? 'rgb(var(--danger-soft))'
                    : alert.level === 'warning'
                      ? 'rgb(var(--warning-soft))'
                      : 'var(--color-surface-2)',
                border: `1px solid ${
                  alert.level === 'critical'
                    ? 'var(--color-danger)'
                    : alert.level === 'warning'
                      ? 'var(--color-warning)'
                      : 'var(--color-border)'
                }`,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {alert.level === 'critical' ? (
                  <IconAlertCircle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                ) : alert.level === 'warning' ? (
                  <IconAlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                ) : (
                  <IconCheck size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                )}
                <div>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{alert.title}</strong>
                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: 6 }}>{alert.detail}</span>
                </div>
              </div>
              {alert.actionLabel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSendQuery(alert.title)}
                  style={{ textDecoration: 'underline', flexShrink: 0 }}
                >
                  {alert.actionLabel}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 4. Strategic Inquiries Quick-Pills Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Suggested Executive Inquiries
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          {STRATEGIC_PROMPTS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.category}
                type="button"
                onClick={() => handleSendQuery(item.prompt)}
                disabled={queryMutation.isPending}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 16,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: 12,
                  cursor: queryMutation.isPending ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--color-surface-2)';
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--color-surface)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              >
                <Icon size={14} style={{ color: 'var(--color-primary)' }} />
                <span>{item.category}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Intelligence Conversation Stream */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minHeight: 280,
          maxHeight: isDrawer ? 'calc(100vh - 420px)' : '600px',
          overflowY: 'auto',
          padding: '12px 14px',
          background: 'var(--color-surface-2)',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Initial CEO Briefing Card */}
        {briefing && (
          <div
            style={{
              padding: 16,
              background: 'var(--color-surface)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--color-shadow-sm, 0 1px 3px rgb(var(--shadow-ink) / 0.04))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconSparkles size={16} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Executive Intelligence Briefing
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Live database snapshot
              </span>
            </div>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--color-text-primary)',
                margin: 0,
                whiteSpace: 'pre-line',
              }}
            >
              {briefing.executiveSummary}
            </p>

            {briefing.strategicSuggestions.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconBulb size={15} style={{ color: 'var(--color-warning)' }} />
                  Priority Strategic Focus Areas
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {briefing.strategicSuggestions.map((sug, idx) => (
                    <div
                      key={sug.id || idx}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'var(--color-surface-2)',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                      }}
                    >
                      <Badge variant={sug.priority === 'high' ? 'danger' : sug.priority === 'medium' ? 'warning' : 'neutral'}>
                        {sug.priority.toUpperCase()}
                      </Badge>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{sug.title}: </strong>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{sug.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Q&A History */}
        {history.map(turn => (
          <div key={turn.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {turn.sender === 'user' ? (
              <div
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  padding: '8px 14px',
                  borderRadius: '12px 12px 2px 12px',
                  background: 'var(--color-primary)',
                  color: 'rgb(var(--accent-fg))',
                  fontSize: 13,
                  boxShadow: 'var(--color-shadow-sm, 0 1px 2px rgb(var(--shadow-ink) / 0.08))',
                }}
              >
                <div>{turn.text}</div>
                <div style={{ fontSize: 10, textAlign: 'right', marginTop: 4, opacity: 0.8 }}>
                  {turn.timestamp}
                </div>
              </div>
            ) : (
              <div
                style={{
                  alignSelf: 'flex-start',
                  width: '100%',
                  padding: 16,
                  borderRadius: '4px 12px 12px 12px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--color-shadow-sm, 0 1px 3px rgb(var(--shadow-ink) / 0.04))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconSparkles size={16} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      Executive AI Analysis
                    </span>
                    {turn.response && (
                      <Badge variant={statusBadgeVariant(turn.response.status)}>
                        {turn.response.intent}
                      </Badge>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{turn.timestamp}</span>
                </div>

                {/* Synthesis Narrative */}
                {turn.response ? (
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: 'var(--color-text-primary)',
                        marginBottom: 12,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: turn.response.answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                      }}
                    />

                    {/* Key Metrics Badges */}
                    {turn.response.keyMetrics.length > 0 && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: 8,
                          margin: '12px 0',
                          padding: 10,
                          borderRadius: 6,
                          background: 'var(--color-surface-2)',
                        }}
                      >
                        {turn.response.keyMetrics.map((km, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{km.label}</span>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color:
                                  km.status === 'optimal'
                                    ? 'var(--color-success)'
                                    : km.status === 'warning'
                                      ? 'var(--color-warning)'
                                      : km.status === 'critical'
                                        ? 'var(--color-danger)'
                                        : 'var(--color-text-primary)',
                              }}
                            >
                              {km.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tabular Data View */}
                    {turn.response.tableData && turn.response.tableData.rows.length > 0 && (() => {
                      const table = turn.response.tableData;
                      return (
                        <div style={{ margin: '14px 0' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                            {table.title}
                          </div>
                          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                                  {table.columns.map(col => (
                                    <th
                                      key={col.key}
                                      style={{
                                        padding: '6px 10px',
                                        textAlign: col.align || 'left',
                                        fontWeight: 600,
                                        color: 'var(--color-text-secondary)',
                                      }}
                                    >
                                      {col.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {table.rows.map((row, rowIdx) => (
                                  <tr
                                    key={rowIdx}
                                    style={{
                                      borderBottom:
                                        rowIdx === table.rows.length - 1
                                          ? 'none'
                                          : '1px solid var(--color-border)',
                                    }}
                                  >
                                    {table.columns.map(col => (
                                      <td
                                        key={col.key}
                                        style={{
                                          padding: '6px 10px',
                                          textAlign: col.align || 'left',
                                          color: 'var(--color-text-primary)',
                                        }}
                                      >
                                        {row[col.key]?.toString() ?? '-'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Actionable Suggestions */}
                    {turn.response.actionableSuggestions.length > 0 && (
                      <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgb(var(--accent-soft))' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <IconBulb size={14} /> Actionable Management Recommendations
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--color-text-primary)' }}>
                          {turn.response.actionableSuggestions.map((sug, idx) => (
                            <li key={idx} style={{ marginTop: 3 }}>
                              {sug}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Follow-up Prompts */}
                    {turn.response.followUpQuestions.length > 0 && (
                      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          Suggested Follow-ups <IconArrowRight size={12} />
                        </span>
                        {turn.response.followUpQuestions.map((fq, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendQuery(fq)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 12,
                              background: 'var(--color-surface-2)',
                              border: '1px solid var(--color-border)',
                              fontSize: 11,
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            {fq}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--color-text-primary)', margin: 0 }}>
                    {turn.text}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {queryMutation.isPending && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '4px 12px 12px 12px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: 'var(--color-text-secondary)',
            }}
          >
            <Spinner size="sm" />
            <span>Consulting live ledger, inventory, and governance database tables...</span>
          </div>
        )}

        <div ref={streamEndRef} />
      </div>

      {/* 6. Executive Query Input Bar */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSendQuery();
        }}
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          background: 'var(--color-surface)',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
        }}
      >
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask anything about financial health, debtors, stock, liquidity, or governance..."
          disabled={queryMutation.isPending}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            color: 'var(--color-text-primary)',
          }}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          icon={<IconSend size={15} />}
          disabled={!question.trim() || queryMutation.isPending}
        >
          {queryMutation.isPending ? 'Analyzing...' : 'Ask'}
        </Button>
      </form>
    </div>
  );
}
