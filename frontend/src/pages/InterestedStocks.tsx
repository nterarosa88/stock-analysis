import { useState, useEffect } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts'

interface InterestRecord {
    group_name: string
    code: string
    name: string
    market_name: string
    buy_date: string | null
    buy_price: number | null
    current_price: number | null
    reg_date: string
    memo: string
    profit_rate: number | null
}

interface PriceHistory {
    date: string
    close: number
    open: number
    high: number
    low: number
    trading_value: number
    ma5: number
    ma20: number
    ma60: number
    ma120: number
    ma240: number
}

const formatDate = (dateStr: string | null) => {
    if (!dateStr || dateStr.length !== 8) return dateStr || '-'
    return `${dateStr.substring(0, 4)}.${dateStr.substring(4, 6)}.${dateStr.substring(6, 8)}`
}

const InterestedStocks = () => {
    const queryClient = useQueryClient()

    // Main Data Query
    const { data: stocks, isLoading } = useQuery({
        queryKey: ['interestedStocks'],
        queryFn: async () => {
            const response = await axios.get('/api/interest')
            return response.data.result as InterestRecord[]
        }
    })

    // Selected Stock for Chart
    // Selected Stock for Chart
    const [selectedStock, setSelectedStock] = useState<{ code: string, name: string, ymd: string, buy_price: number | null } | null>(null)

    // Chart Data Query
    const { data: historyData } = useQuery({
        queryKey: ['stockHistory', selectedStock?.code],
        queryFn: async () => {
            if (!selectedStock) return []
            // Use current date as ref_date if not specific
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
            const response = await axios.get(`/api/stock/history/${selectedStock.code}`, {
                params: { ref_date: today }
            })
            return response.data.result as PriceHistory[]
        },
        enabled: !!selectedStock
    })

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (vars: { group: string, code: string }) => {
            await axios.delete('/api/interest', { params: { group_name: vars.group, code: vars.code } })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interestedStocks'] })
            // If deleted stock was selected, clear selection
            if (selectedStock && stocks?.find(s => s.code === selectedStock.code)) {
                setSelectedStock(null)
            }
        },
        onError: (err) => {
            alert("삭제 중 오류가 발생했습니다.")
            console.error(err)
        }
    })

    // Edit Interest Mutation
    const updateInterestMutation = useMutation({
        mutationFn: async (vars: {
            original_group_name: string,
            code: string,
            new_group_name: string,
            buy_date: string,
            buy_price: number | null
        }) => {
            await axios.put('/api/interest', vars)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interestedStocks'] })
            setIsInterestEditModalOpen(false)
            setEditingInterest(null)
        },
        onError: (err: any) => {
            alert(err.response?.data?.detail || "수정 중 오류가 발생했습니다.")
        }
    })

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row: InterestRecord } | null>(null)
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false)
    const [editingMemo, setEditingMemo] = useState('')
    const [editingRow, setEditingRow] = useState<InterestRecord | null>(null)

    // Edit Interest Modal State
    const [isInterestEditModalOpen, setIsInterestEditModalOpen] = useState(false)
    const [editingInterest, setEditingInterest] = useState<{
        original_group: string,
        code: string,
        name: string,
        group_name: string,
        buy_date: string,
        buy_price: string
    } | null>(null)

    // Tooltip State
    const [hoverTooltip, setHoverTooltip] = useState<{ x: number, y: number, text: string } | null>(null)

    const handleMouseEnterMemo = (e: React.MouseEvent, text: string) => {
        if (!text) return
        setHoverTooltip({
            x: e.clientX, // Initial position, could update on move if needed
            y: e.clientY,
            text: text
        })
    }

    const handleMouseMoveMemo = (e: React.MouseEvent) => {
        if (hoverTooltip) {
            setHoverTooltip(prev => prev ? { ...prev, x: e.clientX + 15, y: e.clientY + 15 } : null)
        }
    }

    const handleMouseLeaveMemo = () => {
        setHoverTooltip(null)
    }

    // Close Context Menu
    useEffect(() => {
        const handleClick = () => setContextMenu(null)
        window.addEventListener('click', handleClick)
        return () => window.removeEventListener('click', handleClick)
    }, [])

    const handleRowDoubleClick = (row: InterestRecord) => {
        // Use Reg Date or Today as reference? Usually chart shows recent history.
        // Let's use today as standard unless user wants to see history around buy date?
        // Let's default to today (latest)
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        setSelectedStock({
            code: row.code,
            name: row.name,
            ymd: today,
            buy_price: row.buy_price
        })
    }

    const handleContextMenu = (e: React.MouseEvent, row: InterestRecord) => {
        e.preventDefault()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            row: row
        })
    }

    const handleDelete = () => {
        if (!contextMenu) return
        if (confirm(`${contextMenu.row.name} 종목을 관심목록에서 삭제하시겠습니까?`)) {
            deleteMutation.mutate({ group: contextMenu.row.group_name, code: contextMenu.row.code })
        }
    }

    const handleEditMemo = () => {
        if (!contextMenu) return
        setEditingRow(contextMenu.row)
        setEditingMemo(contextMenu.row.memo || '')
        setIsMemoModalOpen(true)
        setContextMenu(null)
    }

    const handleEditInterest = () => {
        if (!contextMenu) return
        setEditingInterest({
            original_group: contextMenu.row.group_name,
            code: contextMenu.row.code,
            name: contextMenu.row.name,
            group_name: contextMenu.row.group_name,
            buy_date: contextMenu.row.buy_date || '',
            buy_price: contextMenu.row.buy_price ? String(contextMenu.row.buy_price) : ''
        })
        setIsInterestEditModalOpen(true)
        setContextMenu(null)
    }

    const handleSaveInterestEdit = () => {
        if (!editingInterest) return
        updateInterestMutation.mutate({
            original_group_name: editingInterest.original_group,
            code: editingInterest.code,
            new_group_name: editingInterest.group_name,
            buy_date: editingInterest.buy_date,
            buy_price: editingInterest.buy_price ? parseInt(editingInterest.buy_price) : null
        })
    }

    // Memo Mutation (Reuse from other pages, endpoint /api/stock/memo)
    const memoMutation = useMutation({
        mutationFn: async (vars: { code: string, memo: string }) => {
            await axios.put('/api/stock/memo', vars)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interestedStocks'] }) // Refresh this list too
            setIsMemoModalOpen(false)
            setEditingRow(null)
        },
        onError: (err) => {
            alert('메모 저장 중 오류가 발생했습니다.')
            console.error(err)
        }
    })

    const handleSaveMemo = () => {
        if (!editingRow) return
        memoMutation.mutate({ code: editingRow.code, memo: editingMemo })
    }

    return (
        <div className="h-full flex flex-col p-4 space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-gray-800">조회 &gt; 관심 종목</h1>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-lg shadow overflow-hidden flex-1 min-h-[400px]">
                <div className="overflow-x-auto h-full">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 border-b text-center w-30">그룹</th>
                                <th className="px-4 py-3 border-b text-center w-20">코드</th>
                                <th className="px-4 py-3 border-b text-center w-65">종목명</th>
                                <th className="px-4 py-3 border-b text-center w-20">시장</th>
                                <th className="px-4 py-3 border-b text-center w-24">등록일</th>
                                <th className="px-4 py-3 border-b text-center w-24">매수일</th>
                                <th className="px-4 py-3 border-b text-right w-24">매수가</th>
                                <th className="px-4 py-3 border-b text-right w-24">현재가</th>
                                <th className="px-4 py-3 border-b text-right w-20">수익률</th>
                                <th className="px-4 py-3 border-b text-left">메모</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={10} className="text-center py-10">로딩 중...</td></tr>
                            ) : (!stocks || stocks.length === 0) ? (
                                <tr><td colSpan={10} className="text-center py-10">관심 종목이 없습니다.</td></tr>
                            ) : (
                                stocks.map((row) => (
                                    <tr
                                        key={`${row.group_name}-${row.code}`}
                                        className={`hover:bg-blue-50 cursor-pointer text-xs border-b ${selectedStock?.code === row.code ? 'bg-blue-100' : ''}`}
                                        onDoubleClick={() => handleRowDoubleClick(row)}
                                        onContextMenu={(e) => handleContextMenu(e, row)}
                                    >
                                        <td className="px-4 py-2 text-center text-gray-900 border-r whitespace-nowrap">{row.group_name}</td>
                                        <td className="px-4 py-2 text-center text-gray-500 border-r">{row.code}</td>
                                        <td className="px-4 py-2 text-center text-blue-600 font-medium border-r">{row.name}</td>
                                        <td className="px-4 py-2 text-center text-gray-500 border-r">{row.market_name}</td>
                                        <td className="px-4 py-2 text-center text-gray-500 border-r">{formatDate(row.reg_date)}</td>
                                        <td className="px-4 py-2 text-center text-gray-500 border-r">{formatDate(row.buy_date)}</td>
                                        <td className="px-4 py-2 text-right text-gray-900 border-r">{row.buy_price ? row.buy_price.toLocaleString() : '-'}</td>
                                        <td className="px-4 py-2 text-right text-gray-900 border-r font-bold">{row.current_price ? row.current_price.toLocaleString() : '-'}</td>
                                        <td className={`px-4 py-2 text-right border-r font-bold ${(row.profit_rate || 0) > 0 ? 'text-red-500' : (row.profit_rate || 0) < 0 ? 'text-blue-500' : 'text-gray-500'
                                            }`}>
                                            {row.profit_rate ? `${row.profit_rate}%` : '-'}
                                        </td>
                                        <td
                                            className="px-4 py-2 text-left border-r"
                                            onMouseEnter={(e) => handleMouseEnterMemo(e, row.memo)}
                                            onMouseMove={handleMouseMoveMemo}
                                            onMouseLeave={handleMouseLeaveMemo}
                                        >
                                            {row.memo && row.memo.length > 100
                                                ? `${row.memo.substring(0, 100)}...`
                                                : row.memo}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Chart Area */}
            <div className="h-[400px] bg-white rounded-lg shadow p-4">
                {selectedStock ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={historyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tickFormatter={(val) => val ? `${val.substring(4, 6)}-${val.substring(6, 8)}` : ''} style={{ fontSize: '12px' }} />
                            <YAxis yAxisId="left" orientation="left" domain={['auto', 'auto']} tickFormatter={(val) => val.toLocaleString()} style={{ fontSize: '12px' }} />
                            <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => val >= 100000000 ? `${(val / 100000000).toFixed(0)}억` : val.toLocaleString()} style={{ fontSize: '12px' }} />
                            <Tooltip
                                labelFormatter={(label) => `날짜: ${label}`}
                                contentStyle={{ fontSize: '12px' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="close" stroke="#000000" dot={false} strokeWidth={2} yAxisId="left" name="주가" />
                            <Line type="monotone" dataKey="ma20" stroke="#fbbf24" dot={false} strokeWidth={1} yAxisId="left" name="20일선" />
                            <Line type="monotone" dataKey="ma60" stroke="#22c55e" dot={false} strokeWidth={1} yAxisId="left" name="60일선" />
                            <Line type="monotone" dataKey="ma120" stroke="#a8a29e" dot={false} strokeWidth={3} yAxisId="left" name="120일선" />
                            <Line type="monotone" dataKey="ma240" stroke="#f472b6" dot={false} strokeWidth={3} yAxisId="left" name="240일선" />
                            <Bar
                                yAxisId="right"
                                dataKey="trading_value"
                                name="거래대금"
                                barSize={20}
                                shape={(props: any) => {
                                    const { x, y, width, height, payload } = props;
                                    if (!payload) return <g />;

                                    const isUp = payload.close >= payload.open;
                                    const color = isUp ? '#ef4444' : '#3b82f6';

                                    return <rect x={x} y={y} width={width} height={height} fill={color} opacity={0.4} />;
                                }}
                            />

                            {/* Buy Price Line */}
                            {selectedStock?.buy_price && (
                                <ReferenceLine
                                    y={selectedStock.buy_price}
                                    yAxisId="left"
                                    stroke="red"
                                    strokeDasharray="3 3"
                                    label={{ value: '매수가', position: 'right', fill: 'red', fontSize: 12 }}
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex justify-center items-center h-full text-gray-500">종목을 더블클릭하여 차트를 확인하세요.</div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-white border border-gray-300 shadow-lg rounded py-1 z-50 min-w-[120px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        onClick={handleEditMemo}
                    >
                        메모 수정
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        onClick={handleEditInterest}
                    >
                        관심종목 수정
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                        onClick={handleDelete}
                    >
                        관심종목 삭제
                    </button>
                </div>
            )}

            {/* Memo Modal */}
            {isMemoModalOpen && editingRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                    <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
                        <h3 className="text-lg font-bold mb-4">메모 수정 - {editingRow.name} ({editingRow.code})</h3>
                        <textarea
                            className="w-full h-40 border border-gray-300 rounded p-2 mb-4 focus:outline-none focus:border-blue-500 resize-none"
                            value={editingMemo}
                            onChange={(e) => setEditingMemo(e.target.value)}
                            placeholder="메모를 입력하세요..."
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsMemoModalOpen(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveMemo}
                                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interest Edit Modal */}
            {
                isInterestEditModalOpen && editingInterest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                        <div className="bg-white rounded-lg shadow-xl w-[400px] p-6">
                            <h3 className="text-lg font-bold mb-4">관심종목 수정 - {editingInterest.name} ({editingInterest.code})</h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">그룹명</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                        value={editingInterest.group_name}
                                        onChange={(e) => setEditingInterest({ ...editingInterest, group_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">매수일자</label>
                                    <input
                                        type="text"
                                        placeholder="YYYYMMDD"
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                        value={editingInterest.buy_date}
                                        onChange={(e) => setEditingInterest({ ...editingInterest, buy_date: e.target.value })}
                                        maxLength={8}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">매수가격</label>
                                    <input
                                        type="number"
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                        value={editingInterest.buy_price}
                                        onChange={(e) => setEditingInterest({ ...editingInterest, buy_price: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setIsInterestEditModalOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSaveInterestEdit}
                                    className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
                                >
                                    수정
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Hover Tooltip */}
            {
                hoverTooltip && (
                    <div
                        className="fixed z-[100] bg-gray-900 text-white text-xs p-3 rounded shadow-xl max-w-sm pointer-events-none whitespace-pre-wrap"
                        style={{ top: hoverTooltip.y, left: hoverTooltip.x }}
                    >
                        {hoverTooltip.text}
                    </div>
                )
            }
        </div >
    )
}

export default InterestedStocks
