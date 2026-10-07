                <div className="flex flex-col items-center gap-3 p-4 border border-gray-100 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Barcode size={16} /> Barcode
                  </div>
                  {qrUrl && <BarcodeComponent value={qrUrl} format="CODE128" width={1.8} height={65} fontSize={13} displayValue={true} margin={8} />}
                  <div className="text-xs text-gray-500 break-all max-w-[200px] text-center">{qrUrl}</div>
                  <div className="text-xs text-gray-400">Scan barcode</div>
                </div>
