import { useState } from 'react';
import axios from 'axios';
import { Database, BarChart2 } from 'lucide-react';

const StockMain = () => {
    // State for Stock List Sync
    const [market, setMarket] = useState("0");
    const [listLoading, setListLoading] = useState(false);
    const [listMessage, setListMessage] = useState("");

    // State for Daily Price Sync
    const [priceLoading, setPriceLoading] = useState(false);
    const [priceMessage, setPriceMessage] = useState("");

    const handleListSync = async () => {
        setListLoading(true);
        setListMessage("수집 중...");
        try {
            const response = await axios.post('http://localhost:8000/api/stock/sync', {
                market: market
            });
            setListMessage(`수집 완료: ${response.data.count}건`);
        } catch (error: any) {
            console.error(error);
            setListMessage("수집 실패: " + (error.response?.data?.detail || error.message));
        } finally {
            setListLoading(false);
        }
    };

    const handlePriceSync = async () => {
        setPriceLoading(true);
        setPriceMessage("일별 주가 수집 중... (시간이 오래 걸릴 수 있습니다)");
        try {
            const response = await axios.post('http://localhost:8000/api/stock/daily-price/sync');
            setPriceMessage(`수집 완료: ${response.data.processed}개 종목 처리됨`);
        } catch (error: any) {
            console.error(error);
            setPriceMessage("수집 실패: " + (error.response?.data?.detail || error.message));
        } finally {
            setPriceLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">데이터 동기화</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stock List Sync Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <Database size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">종목정보</h3>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                        <label className="font-medium text-gray-700 whitespace-nowrap">시장구분</label>
                        <select
                            value={market}
                            onChange={(e) => setMarket(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="0">코스피</option>
                            <option value="10">코스닥</option>
                            <option value="8">ETF</option>
                        </select>
                        <button
                            onClick={handleListSync}
                            disabled={listLoading}
                            className="bg-blue-800 text-white px-6 py-2 rounded-lg hover:bg-blue-900 disabled:bg-gray-400 transition-colors font-medium whitespace-nowrap"
                        >
                            {listLoading ? "수집 중..." : "동기화"}
                        </button>
                    </div>
                    {listMessage && (
                        <p className={`text-sm font-medium ${listMessage.includes("실패") ? "text-red-600" : "text-blue-600"}`}>
                            {listMessage}
                        </p>
                    )}
                </div>

                {/* Daily Price Sync Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                            <BarChart2 size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">일별시세</h3>
                    </div>

                    <div className="flex items-center justify-between gap-4 mb-4">
                        <p className="text-gray-700 text-md">
                            전체 종목의 일별 주가(최근 800일)를 수집합니다.
                        </p>
                        <button
                            onClick={handlePriceSync}
                            disabled={priceLoading}
                            className="bg-blue-800 text-white px-6 py-2 rounded-lg hover:bg-blue-900 disabled:bg-gray-400 transition-colors font-medium whitespace-nowrap"
                        >
                            {priceLoading ? "수집 중..." : "동기화"}
                        </button>
                    </div>
                    {priceMessage && (
                        <p className={`text-md font-medium ${priceMessage.includes("실패") ? "text-red-600" : "text-blue-600"}`}>
                            {priceMessage}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default StockMain
