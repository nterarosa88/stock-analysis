import { useState, useEffect } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react'
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

interface BreakoutRecord {
    ymd: string
    code: string
    name: string
    market_code: string
    market_name: string
    market_cap: number
    up_rate: number
    last_price: number
    a_120_disp: number
    b_120_disp: number
    c_period: number
    sector: string
    memo: string
    up_rate_120_low: number
    up_rate_5d: number
    up_rate_10d: number
    up_rate_20d: number
    up_rate_60d: number
    up_rate_120d: number
    up_rate_222d: number
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

const Breakout120 = () => {
    // Current date for default: YYYY-MM
    const getCurrentMonth = () => {
        const d = new Date()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${year}-${month}`
    }

    const [searchMonth, setSearchMonth] = useState(getCurrentMonth())
    const [page, setPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(20)
    const [searchTrigger, setSearchTrigger] = useState(0)

    const queryClient = useQueryClient()

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row: BreakoutRecord } | null>(null)
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false)
    const [editingMemo, setEditingMemo] = useState('')
    const [editingRow, setEditingRow] = useState<BreakoutRecord | null>(null)

    // Interest Modal State
    const [isInterestModalOpen, setIsInterestModalOpen] = useState(false)
    const [interestData, setInterestData] = useState({ group_name: '기본그룹', buy_date: '', buy_price: '' })
    const [interestRow, setInterestRow] = useState<BreakoutRecord | null>(null)


    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null)
        window.addEventListener('click', handleClick)
        return () => window.removeEventListener('click', handleClick)
    }, [])

    // Selected stock for chart
    const [selectedStock, setSelectedStock] = useState<{ code: string, name: string, ymd: string, a_120_disp: number } | null>(null)

    const { data: results, isLoading, error } = useQuery({
        queryKey: ['breakout120', searchTrigger],
        queryFn: async () => {
            // Remove hyphen for API (YYYY-MM -> YYYYMM)
            const ymd = searchMonth.replace('-', '')
            const response = await axios.get('/api/analysis/breakout120', {
                params: { year_month: ymd }
            })
            return response.data.result as BreakoutRecord[]
        },
        enabled: searchTrigger > 0
    })

    const { data: historyData, isLoading: isHistoryLoading } = useQuery({
        queryKey: ['stockHistory', selectedStock?.code, selectedStock?.ymd],
        queryFn: async () => {
            if (!selectedStock) return []
            const response = await axios.get(`/api/stock/history/${selectedStock.code}`, {
                params: { ref_date: selectedStock.ymd }
            })
            return response.data.result as PriceHistory[]
        },
        enabled: !!selectedStock
    })

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
        setSearchTrigger(prev => prev + 1)
        setSelectedStock(null) // Reset selection on new search
    }

    const handleRowDoubleClick = (row: BreakoutRecord) => {
        // ymd in row is YYYYMMDD string from DB
        setSelectedStock({
            code: row.code,
            name: row.name,
            ymd: row.ymd,
            a_120_disp: row.a_120_disp
        })
    }

    const handleContextMenu = (e: React.MouseEvent, row: BreakoutRecord) => {
        e.preventDefault()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            row: row
        })
    }

    const handleEditMemo = () => {
        if (!contextMenu) return
        setEditingRow(contextMenu.row)
        setEditingMemo(contextMenu.row.memo || '')
        setIsMemoModalOpen(true)
        setContextMenu(null)
    }

    const memoMutation = useMutation({
        mutationFn: async (vars: { code: string, memo: string }) => {
            await axios.put('/api/stock/memo', vars)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['breakout120'] })
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

    // Interest Mutation
    const interestMutation = useMutation({
        mutationFn: async (vars: { group_name: string, code: string, buy_date: string | null, buy_price: number | null }) => {
            await axios.post('/api/interest', vars)
        },
        onSuccess: () => {
            setIsInterestModalOpen(false)
            setInterestRow(null)
            alert('관심종목에 추가되었습니다.')
        },
        onError: (err: any) => {
            if (err.response?.status === 400) {
                alert('이미 해당 그룹에 등록된 종목입니다.')
            } else {
                alert('관심종목 추가 중 오류가 발생했습니다.')
                console.error(err)
            }
        }
    })

    const handleAddInterest = () => {
        if (!contextMenu) return
        setInterestRow(contextMenu.row)
        // Default values
        setInterestData({ group_name: '기본그룹', buy_date: '', buy_price: '' })
        setIsInterestModalOpen(true)
        setContextMenu(null)
    }

    const handleSaveInterest = () => {
        if (!interestRow) return
        interestMutation.mutate({
            group_name: interestData.group_name,
            code: interestRow.code,
            buy_date: interestData.buy_date || null,
            buy_price: interestData.buy_price ? Number(interestData.buy_price) : null
        })
    }

    // Pagination
    const totalItems = results ? results.length : 0
    const totalPages = Math.ceil(totalItems / rowsPerPage)
    const paginatedData = results
        ? results.slice((page - 1) * rowsPerPage, page * rowsPerPage)
        : []

    // Helper: format percent
    const fmtPct = (val: number) => {
        if (typeof val !== 'number') return '-'
        return `${val.toFixed(2)}%`
    }

    // Helper: format number
    const fmtNum = (val: number) => {
        if (typeof val !== 'number') return '-'
        return val.toLocaleString()
    }

    return (
        <div className="max-w-full mx-auto p-4 flex flex-col h-full">

            <h2 className="text-xl font-bold mb-4 text-gray-800">분석 &gt; 120일 돌파</h2>

            {/* Search Area */}
            <div className="bg-white border-t-2 border-blue-900 border-b border-gray-300 mb-4 p-4">
                <form onSubmit={handleSearch} className="flex gap-4 items-center">
                    <label className="font-bold text-gray-700">조회년월</label>
                    <input
                        type="month"
                        value={searchMonth}
                        onChange={(e) => setSearchMonth(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        required
                    />
                    <button
                        type="submit"
                        className="flex items-center px-4 py-2 bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 transition-colors rounded-sm"
                    >
                        <Search className="w-4 h-4 mr-1" />
                        조회
                    </button>
                </form>
            </div>

            {/* Controls */}
            <div className="flex justify-end mb-2">
                <select
                    value={rowsPerPage}
                    onChange={(e) => {
                        setRowsPerPage(Number(e.target.value))
                        setPage(1)
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                >
                    <option value="10">10개씩</option>
                    <option value="20">20개씩</option>
                    <option value="50">50개씩</option>
                    <option value="100">100개씩</option>
                </select>
            </div>

            {/* Table */}
            <div className={`bg-white border-t-2 border-slate-600 border-b border-gray-200 overflow-x-auto ${selectedStock ? 'h-96' : ''}`}>
                <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
                    <thead className="bg-orange-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">No</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">일자</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">종목코드</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">종목명</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">시장명</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">시가총액</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">상승률</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">최종가격</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">120일 상단(A)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">120일 하단(B)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">120일 기간(C)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">메모</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">상승률(120일저점)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">상승률(5일)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">상승률(10일)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">상승률(20일)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">상승률(60일)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">상승률(120일)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700">상승률(222일)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {isLoading ? (
                            <tr><td colSpan={20} className="px-6 py-10 text-center text-gray-500">로딩 중...</td></tr>
                        ) : error ? (
                            <tr><td colSpan={20} className="px-6 py-10 text-center text-red-500">오류 발생</td></tr>
                        ) : paginatedData.length === 0 ? (
                            <tr><td colSpan={20} className="px-6 py-10 text-center text-gray-500">데이터가 없습니다. 조회 버튼을 눌러주세요.</td></tr>
                        ) : (
                            paginatedData.map((row, idx) => (
                                <tr
                                    key={`${row.code}-${row.ymd}`}
                                    className={`hover:bg-blue-50 cursor-pointer text-xs ${selectedStock?.code === row.code && selectedStock?.ymd === row.ymd ? 'bg-blue-100' : ''}`}
                                    onDoubleClick={() => handleRowDoubleClick(row)}
                                    onContextMenu={(e) => handleContextMenu(e, row)}
                                >
                                    <td className="px-4 py-2 text-center text-gray-500 border-r">{(page - 1) * rowsPerPage + idx + 1}</td>
                                    <td className="px-4 py-2 text-center text-gray-900 border-r">{row.ymd}</td>
                                    <td className="px-4 py-2 text-center text-blue-600 border-r">{row.code}</td>
                                    <td className="px-4 py-2 text-left text-gray-900 font-medium border-r">{row.name}</td>
                                    <td className="px-4 py-2 text-center text-gray-900 border-r">{row.market_name}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtNum(row.market_cap)}</td>
                                    <td className="px-4 py-2 text-right text-red-600 border-r">{fmtPct(row.up_rate)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtNum(row.last_price)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtNum(row.a_120_disp)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtNum(row.b_120_disp)}</td>
                                    <td className="px-4 py-2 text-center text-gray-900 border-r">{fmtNum(row.c_period)}</td>
                                    <td className="px-4 py-2 text-left text-gray-900 border-r text-ellipsis overflow-hidden max-w-[150px]" title={row.memo}>
                                        {row.memo && row.memo.length > 10 ? row.memo.substring(0, 10) + '...' : row.memo}
                                    </td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.up_rate_120_low)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.up_rate_5d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.up_rate_10d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.up_rate_20d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.up_rate_60d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.up_rate_120d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900">{fmtPct(row.up_rate_222d)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalItems > 0 && (
                <div className="flex justify-center items-center mt-4 gap-2 mb-8">
                    <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        {'<<'}
                    </button>
                    <button
                        onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                        disabled={page === 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600 px-2">
                        {page} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={page === totalPages}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        {'>>'}
                    </button>
                </div>
            )}

            {/* Chart Section */}
            {selectedStock && (
                <div className="border border-gray-300 rounded-lg bg-white shadow-lg p-4 mt-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">
                            {selectedStock.name} ({selectedStock.code}) - {selectedStock.ymd} 기준 12개월 차트
                        </h3>
                        <button
                            onClick={() => setSelectedStock(null)}
                            className="text-gray-500 hover:text-black"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="h-96 w-full">
                        {isHistoryLoading ? (
                            <div className="flex justify-center items-center h-full">로딩 중...</div>
                        ) : historyData && historyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={historyData}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val) => {
                                            if (!val) return ''
                                            return `${val.substring(4, 6)}-${val.substring(6, 8)}`
                                        }}
                                        minTickGap={30}
                                        style={{ fontSize: '12px' }}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        orientation="left"
                                        domain={['auto', 'auto']}
                                        tickFormatter={(val) => val.toLocaleString()}
                                        style={{ fontSize: '12px' }}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        tickFormatter={(val) => {
                                            if (val >= 100000000) return `${(val / 100000000).toFixed(0)}억`
                                            if (val >= 10000) return `${(val / 10000).toFixed(0)}만`
                                            return val.toLocaleString()
                                        }}
                                        style={{ fontSize: '12px' }}
                                    />
                                    <Tooltip
                                        labelFormatter={(label) => `날짜: ${label}`}
                                        formatter={(value: number, name: string) => [
                                            (name === 'trading_value') ? (
                                                value >= 100000000 ? `${(value / 100000000).toFixed(2)}억` : value.toLocaleString()
                                            ) : value.toLocaleString(),
                                            name === 'trading_value' ? '거래대금' :
                                                name === 'close' ? '주가' :
                                                    name === 'ma20' ? '20일선' :
                                                        name === 'ma60' ? '60일선' :
                                                            name === 'ma120' ? '120일선' :
                                                                name === 'ma240' ? '240일선' : name
                                        ]}
                                        contentStyle={{ fontSize: '12px' }}
                                    />
                                    <Legend />

                                    <ReferenceLine
                                        x={selectedStock.ymd}
                                        stroke="#10b981"
                                        strokeDasharray="3 3"
                                        label={{ value: '기준일', position: 'top', fill: '#10b981', fontSize: 12 }}
                                        yAxisId="left"
                                    />
                                    {/* 120-day High Line (A) */}
                                    <ReferenceLine
                                        y={selectedStock.a_120_disp}
                                        stroke="#ff0000"
                                        strokeDasharray="3 3"
                                        yAxisId="left"
                                    />

                                    {/* Main Price Line */}
                                    <Line
                                        type="monotone"
                                        dataKey="close"
                                        stroke="#000000"
                                        dot={false}
                                        strokeWidth={2}
                                        yAxisId="left"
                                        name="주가"
                                    />

                                    {/* Moving Averages */}
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

                                            // Color based on price change (close >= open ? Red : Blue)
                                            // Note: since we only show Close price line, Open might not be strictly visible in main chart, 
                                            // but we still have it in payload from backend.
                                            const isUp = payload.close >= payload.open;
                                            const color = isUp ? '#ef4444' : '#3b82f6';

                                            return <rect x={x} y={y} width={width} height={height} fill={color} opacity={0.4} />;
                                        }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex justify-center items-center h-full text-gray-500">데이터가 없습니다.</div>
                        )}
                    </div>
                </div>
            )}
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
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        onClick={handleAddInterest}
                    >
                        관심종목 추가
                    </button>
                </div>
            )}

            {/* Interest Modal */}
            {isInterestModalOpen && interestRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                    <div className="bg-white rounded-lg shadow-xl w-[400px] p-6">
                        <h3 className="text-lg font-bold mb-4">관심종목 추가 - {interestRow.name} ({interestRow.code})</h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">그룹명</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    value={interestData.group_name}
                                    onChange={(e) => setInterestData({ ...interestData, group_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">매수일자 (선택)</label>
                                <input
                                    type="text"
                                    placeholder="YYYYMMDD"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    value={interestData.buy_date}
                                    onChange={(e) => setInterestData({ ...interestData, buy_date: e.target.value })}
                                    maxLength={8}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">매수가격 (선택)</label>
                                <input
                                    type="number"
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    value={interestData.buy_price}
                                    onChange={(e) => setInterestData({ ...interestData, buy_price: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setIsInterestModalOpen(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveInterest}
                                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
                            >
                                추가
                            </button>
                        </div>
                    </div>
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
        </div>
    )
}

export default Breakout120
