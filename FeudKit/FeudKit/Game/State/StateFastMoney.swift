//
//  StateFastMoney.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class StateFastMoney: FFState {
    public static var ACTION_EXECUTEFASTMONEYACTION: Int = 0x00
    
    private var stateMachine: FFFastMoneyStateMachine?
    
    private var fastmoney: FastMoney
    
    internal init(fastmoney: FastMoney) {
        self.fastmoney = fastmoney
        super.init(type: FFStateType.FAST_MONEY)
    }
    
    public override func initState(data: Any) {
        self.stateMachine = FFFastMoneyStateMachine(fastmoney: fastmoney)
        self.stateMachine!.initialize()
    }
    
    public override func cleanupState() { }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case StateFastMoney.ACTION_EXECUTEFASTMONEYACTION:
            if (data[0] is Int) {
                return self.stateMachine!.getCurrentState()!.executeAction(action: data[0] as! Int, data: data)
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
            }
        default:
            return false
        }
    }
    
    public func getFastMoneyState() -> FFFastMoneyState? {
        if (self.stateMachine != nil) { return self.stateMachine!.getCurrentState() }
        return nil
    }
}
