//
//  FFFastMoneyStateFactory.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class FFFastMoneyStateFactory {
    private static var p1Answer: FFFastMoneyState?
    
    private static var p1Reveal: FFFastMoneyState?
    
    private static var p2Answer: FFFastMoneyState?
    
    private static var p2Reveal: FFFastMoneyState?
    
    public static func getState(type: FFFastMoneyStateType, data: Any) -> FFFastMoneyState {
        switch type {
        case .P1_ANSWER:
            if (self.p1Answer == nil) { self.createP1Answer(fastmoney: data as! FastMoney) }
            return self.p1Answer!
        case .P1_REVEAL:
            if (self.p1Reveal == nil) { self.createP1Reveal(fastmoney: data as! FastMoney) }
            return self.p1Reveal!
        case .P2_ANSWER:
            if (self.p2Answer == nil) { self.createP2Answer(fastmoney: data as! FastMoney) }
            return self.p2Answer!
        case .P2_REVEAL:
            if (self.p2Reveal == nil) { self.createP2Reveal(fastmoney: data as! FastMoney) }
            return self.p2Reveal!
        }
    }
    
    private static func createP1Answer(fastmoney: FastMoney) { self.p1Answer = StateAnswer(fastmoney: fastmoney, player: 0) }
    
    private static func createP1Reveal(fastmoney: FastMoney) { self.p1Reveal = StateReveal(fastmoney: fastmoney, player: 0) }
    
    private static func createP2Answer(fastmoney: FastMoney) { self.p2Answer = StateAnswer(fastmoney: fastmoney, player: 1) }
    
    private static func createP2Reveal(fastmoney: FastMoney) { self.p2Reveal = StateReveal(fastmoney: fastmoney, player: 1) }
}
