//
//  FFFastMoneyState.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/29/23.
//

import Foundation
import SlashKit

public class FFFastMoneyState: State<FFFastMoneyStateType> {
    internal var fastmoney: FastMoney
    
    internal init(fastmoney: FastMoney, player: Int) {
        self.fastmoney = fastmoney
        super.init(type: player == 0 ? FFFastMoneyStateType.P1_ANSWER : FFFastMoneyStateType.P2_ANSWER)
    }
    
    public override func updateState(timeElapsed: Float) { }
    
    public func getFastMoney() -> FastMoney { return self.fastmoney }
}
