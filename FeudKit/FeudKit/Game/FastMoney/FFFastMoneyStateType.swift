//
//  FFFastMoneyStateType.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/29/23.
//

import Foundation

public enum FFFastMoneyStateType: String, CustomStringConvertible {
    public var description: String {
        return self.rawValue
    }
    
    case P1_ANSWER = "p1 answer",
         P1_REVEAL = "p1 reveal",
         P2_ANSWER = "p2 answer",
         P2_REVEAL = "p2 reveal"
}
