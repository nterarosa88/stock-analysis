import { useState, useEffect } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react'
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

interface StockReturnRecord {
    code: string
    name: string
    market_name: string
    market_cap: number
    last_price: number
    return_1d: number
    return_5d: number
    return_10d: number
    return_20d: number
    return_60d: number
    return_120d: number
    return_240d: number
    return_ytd: number
    return_last_yr: number
    listing_date: string
    ymd: string
    memo: string
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

const StockReturns = () => {
    // Search Param State
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [marketCapMin, setMarketCapMin] = useState('')
    const [marketCapMax, setMarketCapMax] = useState('')
    const [marketType, setMarketType] = useState('STOCK') // Default Stock (0,10)
    const [returnType, setReturnType] = useState('1D')
    const [returnVal, setReturnVal] = useState('')

    const [page, setPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [searchTrigger, setSearchTrigger] = useState(0)

    const { data: results, isLoading, error } = useQuery({
        queryKey: ['stockReturns', searchTrigger],
        queryFn: async () => {
            const params: any = {}
            if (code) params.code = code
            if (name) params.name = name
            if (marketCapMin) params.market_cap_min = marketCapMin
            if (marketCapMax) params.market_cap_max = marketCapMax
            if (marketType) params.market_type = marketType
            if (returnType) params.return_type = returnType
            if (returnVal) params.return_val = returnVal

            const response = await axios.get('/api/inquiry/returns', { params })
            return response.data.result as StockReturnRecord[]
        },
        enabled: searchTrigger > 0
    })

    const queryClient = useQueryClient()

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row: StockReturnRecord } | null>(null)
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false)
    const [editingMemo, setEditingMemo] = useState('')
    const [editingRow, setEditingRow] = useState<StockReturnRecord | null>(null)

    // Interest Modal State
    const [isInterestModalOpen, setIsInterestModalOpen] = useState(false)
    const [interestData, setInterestData] = useState({ group_name: '기본그룹', buy_date: '', buy_price: '' })
    const [interestRow, setInterestRow] = useState<StockReturnRecord | null>(null)

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null)
        window.addEventListener('click', handleClick)
        return () => window.removeEventListener('click', handleClick)
    }, [])

    // Selected stock for chart
    const [selectedStock, setSelectedStock] = useState<{ code: string, name: string, ymd: string } | null>(null)

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

    const handleRowDoubleClick = (row: StockReturnRecord) => {
        setSelectedStock({
            code: row.code,
            name: row.name,
            ymd: row.ymd
        })
    }

    const handleContextMenu = (e: React.MouseEvent, row: StockReturnRecord) => {
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
            queryClient.invalidateQueries({ queryKey: ['stockReturns'] })
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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
        setSearchTrigger(prev => prev + 1)
    }

    const handleReset = () => {
        setCode('')
        setName('')
        setMarketCapMin('')
        setMarketCapMax('')
        setMarketType('STOCK')
        setReturnType('1D')
        setReturnVal('')
        setSearchTrigger(0) // Clear results? Or just reset filters. User said "Reset input values".
        // Usually reset doesn't clear table unless re-search is clicked, but let's just reset inputs.
    }

    // Pagination
    const totalItems = results ? results.length : 0
    const totalPages = Math.ceil(totalItems / rowsPerPage)
    const paginatedData = results
        ? results.slice((page - 1) * rowsPerPage, page * rowsPerPage)
        : []

    // Helper: format percent
    const fmtPct = (val: number) => {
        if (val === null || val === undefined) return '-'
        return `${val.toFixed(2)}%`
    }

    // Helper: format number
    const fmtNum = (val: number) => {
        if (val === null || val === undefined) return '-'
        return val.toLocaleString()
    }

    return (
        <div className="max-w-full mx-auto p-4 flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4 text-gray-800">조회 &gt; 종목별 수익률</h2>

            {/* Search Area */}
            <div className="bg-white border border-slate-400 rounded p-4 mb-4 shadow-sm">
                <form onSubmit={handleSearch}>
                    <div className="grid grid-cols-[100px_1fr_100px_1fr] gap-0 border border-slate-300">
                        {/* Row 1 */}
                        <div className="bg-blue-100 p-2 flex items-center border-r border-b border-slate-300 font-semibold text-sm">종목코드</div>
                        <div className="p-1 border-r border-b border-slate-300">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="bg-blue-100 p-2 flex items-center border-r border-b border-slate-300 font-semibold text-sm">종목명</div>
                        <div className="p-1 border-b border-slate-300">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        {/* Row 2 */}
                        <div className="bg-blue-100 p-2 flex items-center border-r border-b border-slate-300 font-semibold text-sm">시총범위(조)</div>
                        <div className="p-1 border-r border-b border-slate-300 flex items-center gap-2">
                            <input
                                type="number"
                                value={marketCapMin}
                                onChange={(e) => setMarketCapMin(e.target.value)}
                                className="w-24 border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            />
                            <span>~</span>
                            <input
                                type="number"
                                value={marketCapMax}
                                onChange={(e) => setMarketCapMax(e.target.value)}
                                className="w-24 border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="bg-blue-100 p-2 flex items-center border-r border-b border-slate-300 font-semibold text-sm">시장</div>
                        <div className="p-1 border-b border-slate-300">
                            <select
                                value={marketType}
                                onChange={(e) => setMarketType(e.target.value)}
                                className="w-full border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            >
                                <option value="STOCK">주식 (코스피+코스닥)</option>
                                <option value="ETF">ETF</option>
                            </select>
                        </div>

                        {/* Row 3 */}
                        <div className="bg-blue-100 p-2 flex items-center border-r border-slate-300 font-semibold text-sm">수익률</div>
                        <div className="p-1 border-r border-slate-300 col-span-3 flex items-center gap-2">
                            <select
                                value={returnType}
                                onChange={(e) => setReturnType(e.target.value)}
                                className="w-32 border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            >
                                <option value="1D">상승률 (1일)</option>
                                <option value="5D">5일</option>
                                <option value="10D">10일</option>
                                <option value="20D">20일</option>
                                <option value="60D">60일</option>
                                <option value="120D">120일</option>
                                <option value="240D">240일</option>
                            </select>
                            <input
                                type="number"
                                value={returnVal}
                                onChange={(e) => setReturnVal(e.target.value)}
                                className="w-32 border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-sm">이상</span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            type="button"
                            onClick={handleReset}
                            className="flex items-center px-4 py-2 bg-slate-600 text-white text-sm font-medium hover:bg-slate-700 transition-colors rounded-sm"
                        >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            초기화
                        </button>
                        <button
                            type="submit"
                            className="flex items-center px-4 py-2 bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 transition-colors rounded-sm"
                        >
                            <Search className="w-4 h-4 mr-1" />
                            조회
                        </button>
                    </div>
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
            <div className="bg-white border-t-2 border-slate-600 border-b border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
                    <thead className="bg-orange-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">종목코드</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">종목명</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">시가총액(조)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">종가</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">상승률(1일)</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">5일</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">10일</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">20일</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">60일</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">120일</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">240일</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 border-r">올해 수익률</th>
                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-700">작년 수익률</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {isLoading ? (
                            <tr><td colSpan={13} className="px-6 py-10 text-center text-gray-500">로딩 중...</td></tr>
                        ) : error ? (
                            <tr><td colSpan={13} className="px-6 py-10 text-center text-red-500">오류 발생</td></tr>
                        ) : paginatedData.length === 0 ? (
                            <tr><td colSpan={13} className="px-6 py-10 text-center text-gray-500">데이터가 없습니다. 조회 버튼을 눌러주세요.</td></tr>
                        ) : (
                            paginatedData.map((row, idx) => (
                                <tr
                                    key={`${row.code}-${idx}`}
                                    className={`hover:bg-blue-50 text-xs cursor-pointer ${selectedStock?.code === row.code ? 'bg-blue-100' : ''}`}
                                    onDoubleClick={() => handleRowDoubleClick(row)}
                                    onContextMenu={(e) => handleContextMenu(e, row)}
                                >
                                    <td className="px-4 py-2 text-center text-blue-600 border-r">{row.code}</td>
                                    <td className="px-4 py-2 text-left text-gray-900 font-medium border-r">{row.name}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtNum(row.market_cap)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtNum(row.last_price)}</td>
                                    <td className="px-4 py-2 text-right text-red-600 border-r">{fmtPct(row.return_1d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.return_5d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.return_10d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.return_20d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.return_60d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.return_120d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.return_240d)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900 border-r">{fmtPct(row.return_ytd)}</td>
                                    <td className="px-4 py-2 text-right text-gray-900">{fmtPct(row.return_last_yr)}</td>
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
                <div className="border border-gray-300 rounded-lg bg-white shadow-lg p-4 mt-4 mb-8">
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

                                    {/* Reference Line for the selected date */}
                                    {selectedStock?.ymd && (
                                        <ReferenceLine
                                            x={selectedStock.ymd}
                                            stroke="#10b981"
                                            strokeDasharray="3 3"
                                            label={{ value: '기준일', position: 'top', fill: '#10b981', fontSize: 12 }}
                                            yAxisId="left"
                                        />
                                    )}

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

export default StockReturns
