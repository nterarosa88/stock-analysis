import { useState } from 'react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'

interface Stock {
    code: string
    name: string
    market_cap: string
    last_price: string
}

const StockList = () => {
    const [market, setMarket] = useState('0') // 0: KOSPI, 10: KOSDAQ
    const [stockName, setStockName] = useState('')
    const [searchTrigger, setSearchTrigger] = useState(0)

    const { data, isLoading, error } = useQuery({
        queryKey: ['stocks', market, searchTrigger],
        queryFn: async () => {
            const response = await axios.get('/api/stock/list', {
                params: {
                    market,
                    stock_name: stockName || undefined
                }
            })
            return response.data.result as Stock[]
        },
        enabled: true
    })

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setSearchTrigger(prev => prev + 1)
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">종목정보 리스트</h2>

            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <form onSubmit={handleSearch} className="flex gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Market</label>
                        <select
                            value={market}
                            onChange={(e) => setMarket(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="0">KOSPI</option>
                            <option value="10">KOSDAQ</option>
                        </select>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock Name</label>
                        <input
                            type="text"
                            value={stockName}
                            onChange={(e) => setStockName(e.target.value)}
                            placeholder="Enter stock name (use % for wildcard)"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Search
                    </button>
                </form>
            </div>

            {isLoading && <div className="text-center py-8">Loading...</div>}
            {error && <div className="text-center py-8 text-red-600">Error loading data</div>}

            {data && (
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Market Cap</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data.map((stock) => (
                                <tr key={stock.code} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stock.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stock.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{stock.last_price}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{stock.market_cap}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data.length === 0 && (
                        <div className="text-center py-8 text-gray-500">No stocks found</div>
                    )}
                </div>
            )}
        </div>
    )
}

export default StockList
