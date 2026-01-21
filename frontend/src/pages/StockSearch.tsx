import { useState } from 'react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Search, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'

interface Stock {
    code: string
    name: string
    market_cap: number
    last_price: number
    market: string
    sector: string
    update_date: string
}

const StockSearch = () => {
    // Search Filters
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [marketCapMin, setMarketCapMin] = useState('')
    const [marketCapMax, setMarketCapMax] = useState('')
    const [marketType, setMarketType] = useState('0') // Default to KOSPI (0) as per image? Or 'All'? Image shows "거래소" (Exchange/KOSPI)

    // Pagination
    const [page, setPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)

    // Trigger for search
    const [searchTrigger, setSearchTrigger] = useState(0)

    const { data, isLoading, error } = useQuery({
        queryKey: ['stockSearch', searchTrigger],
        queryFn: async () => {
            const response = await axios.get('/api/stock/search', {
                params: {
                    code: code || undefined,
                    name: name || undefined,
                    market_cap_min: marketCapMin || undefined,
                    market_cap_max: marketCapMax || undefined,
                    market_type: marketType === 'all' ? undefined : marketType
                }
            })
            return response.data.result as Stock[]
        },
        enabled: searchTrigger > 0 // Only run when triggered (or initial load if we want)
    })

    const handleSearch = (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        setSearchTrigger(prev => prev + 1)
        setPage(1) // Reset to first page on new search
    }

    const handleReset = () => {
        setCode('')
        setName('')
        setMarketCapMin('')
        setMarketCapMax('')
        setMarketType('0')
    }

    // Pagination Logic
    const totalItems = data ? data.length : 0
    const totalPages = Math.ceil(totalItems / rowsPerPage)
    const paginatedData = data ? data.slice((page - 1) * rowsPerPage, page * rowsPerPage) : []

    // Helper to format numbers
    const formatNumber = (num: number) => {
        return num.toLocaleString()
    }

    // Helper to format Market Cap to Trillions (조)
    const formatMarketCap = (cap: number) => {
        // cap is in Won. 1 Trillion = 1,000,000,000,000
        const trillion = cap / 1000000000000
        return trillion.toFixed(2)
    }

    return (
        <div className="max-w-7xl mx-auto p-4">
            <h2 className="text-xl font-bold mb-4 text-gray-800">조회 &gt; 종목 검색</h2>

            {/* Search Filter Box - Table Layout */}
            <div className="bg-white border-t-2 border-blue-900 border-b border-gray-300 mb-4">
                <form onSubmit={handleSearch}>
                    {/* Row 1 */}
                    <div className="flex border-b border-gray-200">
                        <div className="w-32 bg-blue-50 p-2 flex items-center justify-center font-medium text-sm border-r border-gray-200">
                            종목코드
                        </div>
                        <div className="flex-1 p-1 border-r border-gray-200">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full h-full border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="w-32 bg-blue-50 p-2 flex items-center justify-center font-medium text-sm border-r border-gray-200">
                            종목명
                        </div>
                        <div className="flex-1 p-1">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full h-full border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div className="flex border-b border-gray-200">
                        <div className="w-32 bg-blue-50 p-2 flex items-center justify-center font-medium text-sm border-r border-gray-200">
                            시총범위(천억)
                        </div>
                        <div className="flex-1 p-1 flex items-center gap-2 border-r border-gray-200">
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
                        <div className="w-32 bg-blue-50 p-2 flex items-center justify-center font-medium text-sm border-r border-gray-200">
                            분류
                        </div>
                        <div className="flex-1 p-1">
                            <select
                                value={marketType}
                                onChange={(e) => setMarketType(e.target.value)}
                                className="w-full h-full border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            >
                                <option value="all">전체</option>
                                <option value="0">거래소</option>
                                <option value="10">코스닥</option>
                                <option value="8">ETF</option>
                            </select>
                        </div>
                    </div>

                    {/* Buttons */}
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

            {/* Results Table Controls */}
            <div className="flex justify-end mb-2">
                <select
                    value={rowsPerPage}
                    onChange={(e) => {
                        setRowsPerPage(Number(e.target.value))
                        setPage(1)
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                </select>
            </div>

            <div className="bg-white border-t-2 border-gray-400 border-b border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-orange-100">
                        <tr>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-orange-100">종목코드</th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-orange-100">종목</th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-orange-100">시총(조)</th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-orange-100">전일종가</th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-orange-100">분류</th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300 bg-orange-100">업종명</th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-700 bg-orange-100">갱신일자</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">조회 중...</td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-4 text-center text-sm text-red-500">조회 중 오류 발생</td>
                            </tr>
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">자료 없음</td>
                            </tr>
                        ) : (
                            paginatedData.map((stock) => (
                                <tr key={stock.code} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 border-r border-gray-200">{stock.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-left text-gray-900 border-r border-gray-200">{stock.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 border-r border-gray-200">{formatMarketCap(stock.market_cap)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 border-r border-gray-200">{formatNumber(stock.last_price)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 border-r border-gray-200">{stock.market}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-left text-gray-900 border-r border-gray-200">{stock.sector}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">{stock.update_date}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {data && data.length > 0 && (
                <div className="flex justify-center items-center mt-4 gap-2">
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

                    {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                        // Simple logic to show window of pages, centered on current page if possible
                        let startPage = Math.max(1, page - 4);
                        if (startPage + 9 > totalPages) {
                            startPage = Math.max(1, totalPages - 9);
                        }
                        const pageNum = startPage + i;
                        if (pageNum > totalPages) return null;

                        return (
                            <button
                                key={pageNum}
                                onClick={() => setPage(pageNum)}
                                className={`w-8 h-8 flex items-center justify-center rounded text-sm ${page === pageNum
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                            >
                                {pageNum}
                            </button>
                        )
                    })}

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
        </div>
    )
}

export default StockSearch
