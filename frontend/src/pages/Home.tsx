import { ArrowRight, BarChart2, Database, Search, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const Home = () => {
    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="relative bg-gradient-to-r from-blue-900 to-indigo-800 rounded-2xl p-8 text-white overflow-hidden shadow-xl">
                <div className="relative z-10">
                    <h1 className="text-4xl font-bold mb-4">Rich Brother에 오신 것을 환영합니다</h1>
                    <p className="text-blue-100 text-lg max-w-2xl mb-8">
                        전문적인 주식 시장 분석 플랫폼입니다. 데이터를 동기화하고, 추세를 분석하며, 실시간 통찰력을 통해 정보에 입각한 투자 결정을 내리세요.
                    </p>
                    <div className="flex gap-4">
                        <Link to="/stock/search" className="bg-white text-blue-900 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors inline-flex items-center gap-2">
                            분석 시작하기 <ArrowRight size={20} />
                        </Link>
                        <Link to="/stock/main" className="bg-blue-700/50 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700/70 transition-colors backdrop-blur-sm">
                            데이터 관리
                        </Link>
                    </div>
                </div>
                {/* Abstract Background Decoration */}
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-white/10 to-transparent transform skew-x-12"></div>
                <div className="absolute right-20 bottom-0 h-64 w-64 bg-blue-500/20 rounded-full blur-3xl"></div>
            </div>

            {/* Quick Stats / Market Overview (Placeholder) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">코스피 (KOSPI)</p>
                            <h3 className="text-2xl font-bold text-gray-900">2,542.36</h3>
                        </div>
                        <span className="bg-red-100 text-red-600 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <TrendingUp size={12} /> +0.8%
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-red-500 h-1.5 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">코스닥 (KOSDAQ)</p>
                            <h3 className="text-2xl font-bold text-gray-900">845.21</h3>
                        </div>
                        <span className="bg-blue-100 text-blue-600 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <TrendingUp size={12} className="transform rotate-180" /> -0.3%
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">원/달러 환율</p>
                            <h3 className="text-2xl font-bold text-gray-900">1,320.50</h3>
                        </div>
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            0.0%
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-gray-400 h-1.5 rounded-full" style={{ width: '50%' }}></div>
                    </div>
                </div>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link to="/stock/search" className="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1">
                    <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Search size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">종목 검색</h3>
                    <p className="text-gray-500 text-sm">
                        종목 코드, 이름 또는 시가총액으로 주식을 검색하고 상세한 가격 기록을 확인하세요.
                    </p>
                </Link>

                <Link to="/stock/main" className="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1">
                    <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Database size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">데이터 동기화</h3>
                    <p className="text-gray-500 text-sm">
                        Kiwoom API에서 주식 목록 및 시장 데이터를 로컬 데이터베이스로 동기화합니다.
                    </p>
                </Link>

                <Link to="/stock/main" className="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1">
                    <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <BarChart2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">일별 시세</h3>
                    <p className="text-gray-500 text-sm">
                        모든 주식의 일별 가격 기록을 가져오고 업데이트합니다. 과거 추세를 분석하세요.
                    </p>
                </Link>
            </div>
        </div>
    );
};

export default Home;
