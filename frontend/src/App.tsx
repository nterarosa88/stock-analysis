import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import StockList from './pages/StockList'
import StockMain from './pages/StockMain'
import StockSearch from './pages/StockSearch'
import Home from './pages/Home'
import Breakout120 from './pages/Breakout120'
import Breakout120v2 from './pages/Breakout120v2'
import StockReturns from './pages/StockReturns'
import InterestedStocks from './pages/InterestedStocks'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />

          <Route path="stock">
            <Route path="search" element={<StockSearch />} />
            <Route path="list" element={<StockList />} />
            <Route path="main" element={<StockMain />} />
          </Route>

          <Route path="analysis">
            <Route path="breakout120" element={<Breakout120 />} />
            <Route path="breakout120v2" element={<Breakout120v2 />} />
          </Route>

          <Route path="inquiry">
            <Route path="returns" element={<StockReturns />} />
            <Route path="interest" element={<InterestedStocks />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
